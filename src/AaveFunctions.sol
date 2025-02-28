// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {FundraiserStorage} from "./FundraiserStorage.sol";
import {AaveHelpers} from "./AaveHelpers.sol";
import {IPool} from "./interfaces/IPool.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

library AaveFunctions {
    using SafeERC20 for IERC20;

    /**
     * @notice Internal function to deposit USDC to Aave
     * @param self Storage pointer to FundraiserStorage.State
     * @param callingContract The calling contract's address
     * @return success Whether the deposit was successful
     */
    function depositToAave(FundraiserStorage.State storage self, address callingContract) internal returns (bool) {
        if (!self.aaveEnabled) return false;

        uint256 amountToDeposit =
            AaveHelpers.calculateDepositAmount(self.usdcAddress, callingContract, self.emergencyReservePercentage);

        // Only deposit if amount is significant
        if (amountToDeposit < 1000) return false;

        // Use AaveHelpers to deposit to Aave
        bool success =
            AaveHelpers.depositToAave(self.usdcAddress, self.aavePoolAddress, amountToDeposit, callingContract);

        if (success) {
            // Update our internal accounting
            self.totalDeposited += amountToDeposit;
            return true;
        }

        return false;
    }

    /**
     * @notice Internal function to withdraw USDC from Aave
     * @param _amount Amount to withdraw in base units
     * @return Amount actually withdrawn (may be less than requested)
     */
    function withdrawFromAave(FundraiserStorage.State storage self, uint256 _amount) internal returns (uint256) {
        if (!self.aaveEnabled || _amount == 0 || self.totalDeposited == 0) return 0;

        // Cap withdrawal to what we've deposited
        uint256 amountToWithdraw = _amount > self.totalDeposited ? self.totalDeposited : _amount;

        // Record balance before withdrawal to calculate actual withdrawn amount
        uint256 balanceBefore = IERC20(self.usdcAddress).balanceOf(address(this));

        // Use AaveHelpers to withdraw from Aave
        uint256 actualWithdrawn =
            AaveHelpers.withdrawFromAave(self.usdcAddress, self.aavePoolAddress, amountToWithdraw, address(this));

        if (actualWithdrawn > 0) {
            // Verify actual withdrawn amount
            uint256 balanceAfter = IERC20(self.usdcAddress).balanceOf(address(this));
            uint256 confirmedAmount = balanceAfter > balanceBefore ? balanceAfter - balanceBefore : 0;

            // Use the confirmed amount for accounting
            actualWithdrawn = confirmedAmount;

            // Update total deposited
            self.totalDeposited = self.totalDeposited > actualWithdrawn ? self.totalDeposited - actualWithdrawn : 0;
        }

        return actualWithdrawn;
    }

    /**
     * @notice Emergency function to withdraw all funds from Aave
     * @dev Uses multiple strategies to attempt recovery of funds in case of Aave issues.
     *      Updates internal accounting based on actual amounts withdrawn.
     */
    function emergencyWithdrawFromAave(FundraiserStorage.State storage self) external returns (uint256) {
        if (!self.aaveEnabled || self.totalDeposited == 0) revert FundraiserStorage.InvalidInput(5);

        uint256 amountWithdrawn = 0;
        try IPool(self.aavePoolAddress).withdraw(self.usdcAddress, type(uint256).max, address(this)) returns (
            uint256 withdrawnAmount
        ) {
            amountWithdrawn = withdrawnAmount;
        } catch {
            // Even if withdraw fails, try to get aUSDC balance
            try IERC20(self.aUsdcAddress).balanceOf(address(this)) returns (uint256 aTokenBalance) {
                if (aTokenBalance > 0) {
                    // Try to redeem all aTokens
                    try IPool(self.aavePoolAddress).withdraw(self.usdcAddress, type(uint256).max, address(this))
                    returns (uint256 redeemAmount) {
                        amountWithdrawn = redeemAmount;
                    } catch {
                        amountWithdrawn = 0;
                    }
                }
            } catch {
                amountWithdrawn = 0;
            }
        }

        // Update accounting with what we actually withdrew
        if (amountWithdrawn > 0) {
            self.totalDeposited = self.totalDeposited > amountWithdrawn ? self.totalDeposited - amountWithdrawn : 0;
        }

        return amountWithdrawn;
    }

    /**
     * @notice Distributes yield generated from Aave deposits to a recipient
     * @dev Withdraws from Aave but doesn't reduce totalDeposited, creating an accounting difference
     *      that represents the yield. Only callable by contract owner.
     * @param _recipient Address to receive the yield
     * @param _amount Amount of yield to distribute in normal USDC units
     */
    function distributeYield(FundraiserStorage.State storage self, address _recipient, uint256 _amount)
        external
        returns (bool)
    {
        if (_recipient == address(0)) revert FundraiserStorage.InvalidAddress();
        if (_amount == 0) revert FundraiserStorage.InvalidInput(2);

        // Calculate available yield
        uint256 amountInBaseUnits = _amount * self.USDC_DECIMAL_FACTOR;

        // Calculate available yield
        uint256 availableYield = 0;
        if (self.aaveEnabled) {
            try IERC20(self.aUsdcAddress).balanceOf(address(this)) returns (uint256 aUsdcBalance) {
                if (aUsdcBalance > self.totalDeposited) {
                    availableYield = aUsdcBalance - self.totalDeposited;
                }
            } catch {
                return false;
            }
        }

        if (availableYield < amountInBaseUnits) revert FundraiserStorage.InvalidInput(7);

        // For yield distribution, we withdraw from Aave but don't reduce totalDeposited
        // This creates the accounting difference that represents the yield
        uint256 contractBalanceBefore = IERC20(self.usdcAddress).balanceOf(address(this));

        if (contractBalanceBefore < amountInBaseUnits) {
            // Need to withdraw from Aave without reducing totalDeposited
            uint256 amountToWithdraw = amountInBaseUnits - contractBalanceBefore;
            try IPool(self.aavePoolAddress).withdraw(self.usdcAddress, amountToWithdraw, address(this)) returns (
                uint256
            ) {
                // Withdrawal successful
            } catch {
                return false;
            }
        }

        // Transfer the yield to the recipient
        IERC20(self.usdcAddress).safeTransfer(_recipient, amountInBaseUnits);

        return true;
    }

    /**
     * @notice Force Aave deposits if funds have accumulated in the contract
     * @dev Can be called when normal deposits haven't triggered sufficient Aave deposits.
     *      Useful for manually managing yield generation. Only callable by owner.
     */
    function forceAaveDeposit(FundraiserStorage.State storage self) external returns (bool) {
        if (!self.aaveEnabled) revert FundraiserStorage.InvalidInput(5);
        return depositToAave(self, address(this));
    }

    /**
     * @notice Reconcile internal accounting with actual Aave balance
     * @dev This can be called periodically to ensure accounting accuracy
     */
    function reconcileAaveBalance(FundraiserStorage.State storage self) external {
        if (!self.aaveEnabled) return;

        try IERC20(self.aUsdcAddress).balanceOf(address(this)) returns (uint256 aUsdcBalance) {
            // Update our internal accounting to match reality
            self.totalDeposited = aUsdcBalance;
        } catch {
            // If we can't get the balance, don't update anything
        }
    }

    /**
     * @notice Calculate the available yield (in base units)
     * @return Available yield
     */
    function getAvailableYield(FundraiserStorage.State storage self) internal view returns (uint256) {
        return AaveHelpers.getAvailableYield(self.aUsdcAddress, address(this), self.totalDeposited)
            / self.USDC_DECIMAL_FACTOR;
    }

    /**
     * @notice Enable or disable Aave integration
     * @param self Storage pointer to FundraiserStorage.State
     * @param _enabled Whether Aave integration is enabled
     */
    function setAaveEnabled(FundraiserStorage.State storage self, bool _enabled) internal {
        self.aaveEnabled = _enabled;
    }

    /**
     * @notice Update the emergency reserve percentage
     * @param self Storage pointer to FundraiserStorage.State
     * @param _newPercentage New percentage (0-100)
     */
    function setEmergencyReservePercentage(FundraiserStorage.State storage self, uint256 _newPercentage) internal {
        if (_newPercentage > 100) revert FundraiserStorage.PercentageOutOfRange();
        self.emergencyReservePercentage = _newPercentage;
    }

    /**
     * @notice Checks if internal accounting matches actual Aave balance
     */
    function checkAaveAccountingAccuracy(FundraiserStorage.State storage self) internal view returns (bool) {
        (uint256 internalBalance, uint256 aaveBalance, int256 difference) =
            AaveHelpers.getAaveBalanceAccuracy(self.aUsdcAddress, address(this), self.totalDeposited, self.aaveEnabled);

        // Allow small discrepancy (up to 0.1%) due to rounding in interest calculations
        int256 toleranceThreshold = int256(internalBalance) / 1000;

        return (difference >= 0 || -difference <= toleranceThreshold);
    }
}
