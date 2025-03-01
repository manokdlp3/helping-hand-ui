// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IPool} from "./interfaces/IPool.sol";

/**
 * @title AaveHelpers
 * @notice Helper functions for Aave integration
 */
library AaveHelpers {
    /**
     * @notice Deposit USDC to Aave
     * @param usdcAddress The address of the USDC token
     * @param aavePoolAddress The address of the Aave pool
     * @param amountToDeposit Amount to deposit in base units
     * @param onBehalfOf The address that will receive the aTokens
     * @return success Whether the deposit was successful
     */
    function depositToAave(address usdcAddress, address aavePoolAddress, uint256 amountToDeposit, address onBehalfOf)
        internal
        returns (bool success)
    {
        // Reset approval and approve
        if (!IERC20(usdcAddress).approve(aavePoolAddress, 0)) return false;
        if (!IERC20(usdcAddress).approve(aavePoolAddress, amountToDeposit)) return false;

        // try/catch for the actual Aave call
        try IPool(aavePoolAddress).supply(usdcAddress, amountToDeposit, onBehalfOf, 0) {
            return true;
        } catch {
            return false;
        }
    }

    /**
     * @notice Withdraw USDC from Aave
     * @param usdcAddress The address of the USDC token
     * @param aavePoolAddress The address of the Aave pool
     * @param amountToWithdraw Amount to withdraw in base units
     * @param to The address that will receive the underlying asset
     * @return withdrawnAmount The amount that was successfully withdrawn
     */
    function withdrawFromAave(address usdcAddress, address aavePoolAddress, uint256 amountToWithdraw, address to)
        internal
        returns (uint256 withdrawnAmount)
    {
        try IPool(aavePoolAddress).withdraw(usdcAddress, amountToWithdraw, to) returns (uint256 amount) {
            return amount;
        } catch {
            return 0;
        }
    }

    /**
     * @notice Calculate amount to deposit to Aave based on contract balance and reserve percentage
     */
    function calculateDepositAmount(address usdcAddress, address contractAddress, uint256 emergencyReservePercentage)
        internal
        view
        returns (uint256)
    {
        uint256 contractBalance = IERC20(usdcAddress).balanceOf(contractAddress);
        uint256 reserveAmount = (contractBalance * emergencyReservePercentage) / 100;
        uint256 amountToDeposit = contractBalance > reserveAmount ? contractBalance - reserveAmount : 0;

        // Only deposit if amount is significant to save gas
        return amountToDeposit < 1000 ? 0 : amountToDeposit;
    }

    /**
     * @notice Try to get aToken balance securely
     */
    function getATokenBalance(address aTokenAddress, address owner) internal view returns (uint256, bool) {
        try IERC20(aTokenAddress).balanceOf(owner) returns (uint256 balance) {
            return (balance, true);
        } catch {
            return (0, false);
        }
    }

    /**
     * @notice Вычисляет доступный доход (в базовых единицах)
     */
    function getAvailableYield(address aUsdcAddress, address contractAddress, uint256 totalDeposited)
        internal
        view
        returns (uint256)
    {
        try IERC20(aUsdcAddress).balanceOf(contractAddress) returns (uint256 aUsdcBalance) {
            // Если баланс aUSCT меньше общего депозита (возможно при убытках), вернуть 0
            if (aUsdcBalance <= totalDeposited) return 0;

            return (aUsdcBalance - totalDeposited);
        } catch {
            return 0;
        }
    }

    /**
     * @notice Сравнивает внутренний учет с актуальным балансом Aave
     */
    function getAaveBalanceAccuracy(
        address aUsdcAddress,
        address contractAddress,
        uint256 totalDeposited,
        bool aaveEnabled
    ) internal view returns (uint256 internalBalance, uint256 aaveBalance, int256 difference) {
        internalBalance = totalDeposited;
        aaveBalance = 0;

        if (aaveEnabled) {
            try IERC20(aUsdcAddress).balanceOf(contractAddress) returns (uint256 aUsdcBalance) {
                aaveBalance = aUsdcBalance;
            } catch {
                // Если не можем получить актуальный баланс, возвращаем нули
                return (internalBalance, 0, -int256(internalBalance));
            }
        }

        // Вычисляем разницу (может быть отрицательной, если мы потеряли ценность)
        if (aaveBalance >= internalBalance) {
            difference = int256(aaveBalance - internalBalance);
        } else {
            difference = -int256(internalBalance - aaveBalance);
        }

        return (internalBalance, aaveBalance, difference);
    }
}
