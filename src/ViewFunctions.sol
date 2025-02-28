// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {FundraiserStorage} from "./FundraiserStorage.sol";
import {FundraiserLogic} from "./FundraiserLogic.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

library ViewFunctions {
    /**
     * @notice Get the total USDC (in normal USDC units) stored in this contract.
     */
    function getContractBalance(FundraiserStorage.State storage self) external view returns (uint256) {
        uint256 baseUnits = IERC20(self.usdcAddress).balanceOf(address(this));
        return baseUnits / self.USDC_DECIMAL_FACTOR;
    }

    /**
     * @notice Get the USDC balance (in normal USDC units) for a specific fundraiser.
     */
    function getBalanceOfFundraiser(FundraiserStorage.State storage self, uint256 _fundraiserId) external view returns (uint256) {
        if (_fundraiserId >= self.fundraiserEventCounter) revert FundraiserStorage.InvalidInput(1);
        return self.idToFundraiserEvent[_fundraiserId].amountRaised / self.USDC_DECIMAL_FACTOR;
    }

    /**
     * @notice How much has a user contributed to a specific fundraiser (in normal units)?
     */
    function getUserContribution(FundraiserStorage.State storage self, address _user, uint256 _fundraiserId) external view returns (uint256) {
        if (_fundraiserId >= self.fundraiserEventCounter) revert FundraiserStorage.InvalidInput(1);
        return self.userContributions[_user][_fundraiserId] / self.USDC_DECIMAL_FACTOR;
    }

    /**
     * @notice Returns the entire `Fundraiser` struct for a given _fundraiserId,
     *         with amounts converted to normal USDC units (instead of base units).
     */
    function getFundraiser(FundraiserStorage.State storage self, uint256 _fundraiserId) external view returns (
        address owner,
        uint256 startDate,
        uint256 endDate,
        string memory subject,
        string memory additionalDetails,
        uint256 fundraiserGoal,
        uint256 amountRaised,
        bool isCompleted,
        bool goalReached
    ) {
        if (_fundraiserId >= self.fundraiserEventCounter) revert FundraiserStorage.InvalidInput(1);
        FundraiserStorage.Fundraiser storage fundraiser = self.idToFundraiserEvent[_fundraiserId];
        
        // Split calculations into multiple steps to reduce stack depth
        owner = fundraiser.owner;
        startDate = fundraiser.startDate;
        endDate = fundraiser.endDate;
        subject = self.contentRegistry[fundraiser.subjectHash];
        additionalDetails = self.contentRegistry[fundraiser.detailsHash];
        fundraiserGoal = fundraiser.fundraiserGoal / self.USDC_DECIMAL_FACTOR;
        amountRaised = fundraiser.amountRaised / self.USDC_DECIMAL_FACTOR;
        
        // Calculate these values separately
        isCompleted = FundraiserLogic.isFundraiserCompleted(fundraiser);
        goalReached = fundraiser.amountRaised >= fundraiser.fundraiserGoal;
    }
    
    /**
     * @notice Helper to convert a normal USDC amount to base units (6 decimals).
     * @param _amount Normal USDC units, e.g. 10 => 10 USDC => 10,000,000 base units
     */
    function getAmountInBaseUnits(FundraiserStorage.State storage self, uint256 _amount) external view returns (uint256) {
        return _amount * self.USDC_DECIMAL_FACTOR;
    }

    /**
     * @notice Checks how much USDC allowance this contract has from the user
     * @return The amount of USDC this contract is allowed to spend on behalf of msg.sender
     */
    function checkAllowance(FundraiserStorage.State storage self, address user, address contractAddress) external view returns (uint256) {
        IERC20 usdc = IERC20(self.usdcAddress);
        return usdc.allowance(user, contractAddress);
    }

    /**
     * @notice Helper function that returns the USDC contract address
     * @return The address of the USDC contract used by this FundraiserFactory
     */
    function getUSDCAddress(FundraiserStorage.State storage self) external view returns (address) {
        return self.usdcAddress;
    }

    /**
     * @notice Helps calculate the amount in base units for approvals
     * @param _amount Example amount in normal USDC units that would need approval
     * @return The amount in base units that should be used in the USDC approve() call
     */
    function getApprovalAmount(FundraiserStorage.State storage self, uint256 _amount) external view returns (uint256) {
        return _amount * self.USDC_DECIMAL_FACTOR;
    }
    
    /**
     * @notice Provides instructions on how to approve USDC for this contract
     * @return Instructions on how to perform the approval in Remix
     */
    function getApprovalInstructions(FundraiserStorage.State storage self) external view returns (string memory) {
        return string(abi.encodePacked(
            "To approve USDC spending in Remix:\n",
            "1. Go to the 'Deploy & Run' tab\n",
            "2. Select 'IERC20' from the contract dropdown\n",
            "3. Enter USDC address: ", FundraiserLogic.addressToString(self.usdcAddress), "\n",
            "4. Click 'At Address' to load the USDC contract\n",
            "5. Find the 'approve' function\n",
            "6. Enter this contract's address: ", FundraiserLogic.addressToString(address(this)), "\n",
            "7. Enter amount with 6 decimals (e.g. 10 USDC = 10000000)\n",
            "8. Click 'transact' to approve"
        ));
    }
    
    /**
     * @notice Batch retrieval of multiple fundraisers for efficient data loading
     * @dev Limits batch size to prevent out-of-gas errors.
     *      Useful for frontends and UIs that need to display multiple fundraisers.
     * @param _fromId Starting fundraiser ID
     * @param _count Maximum number of fundraisers to return (capped at 50)
     * @return response A BatchResponse struct containing arrays of fundraiser data
     */
    function batchGetFundraisers(
        FundraiserStorage.State storage self, 
        uint256 _fromId, 
        uint256 _count
    ) external view returns (FundraiserStorage.BatchResponse memory response) {
        // Limit batch size to prevent out-of-gas errors
        uint256 maxBatchSize = 50;
        uint256 actualCount = _count > maxBatchSize ? maxBatchSize : _count;
        
        // Calculate the actual count based on available fundraisers
        if (_fromId + actualCount > self.fundraiserEventCounter) {
            actualCount = self.fundraiserEventCounter > _fromId ? self.fundraiserEventCounter - _fromId : 0;
        }
        
        // If no fundraisers to return, return empty arrays
        if (actualCount == 0) {
            return FundraiserStorage.BatchResponse({
                owners: new address[](0),
                startDates: new uint256[](0),
                endDates: new uint256[](0),
                subjectHashes: new bytes32[](0),
                detailsHashes: new bytes32[](0),
                fundraiserGoals: new uint256[](0),
                amountsRaised: new uint256[](0),
                areCompleted: new bool[](0),
                goalsReached: new bool[](0)
            });
        }
        
        // Initialize arrays
        response.owners = new address[](actualCount);
        response.startDates = new uint256[](actualCount);
        response.endDates = new uint256[](actualCount);
        response.subjectHashes = new bytes32[](actualCount);
        response.detailsHashes = new bytes32[](actualCount);
        response.fundraiserGoals = new uint256[](actualCount);
        response.amountsRaised = new uint256[](actualCount);
        response.areCompleted = new bool[](actualCount);
        response.goalsReached = new bool[](actualCount);
        
        // Populate arrays
        for (uint256 i = 0; i < actualCount; i++) {
            uint256 fundraiserId = _fromId + i;
            FundraiserStorage.Fundraiser storage fundraiser = self.idToFundraiserEvent[fundraiserId];
            
            response.owners[i] = fundraiser.owner;
            response.startDates[i] = fundraiser.startDate;
            response.endDates[i] = fundraiser.endDate;
            response.subjectHashes[i] = fundraiser.subjectHash;
            response.detailsHashes[i] = fundraiser.detailsHash;
            response.fundraiserGoals[i] = fundraiser.fundraiserGoal / self.USDC_DECIMAL_FACTOR;
            response.amountsRaised[i] = fundraiser.amountRaised / self.USDC_DECIMAL_FACTOR;
            response.areCompleted[i] = FundraiserLogic.isFundraiserCompleted(fundraiser);
            response.goalsReached[i] = fundraiser.amountRaised >= fundraiser.fundraiserGoal;
        }
        
        return response;
    }
    
    /**
     * @notice Check contract status - Part 1: Basic status info
     * @param isPaused Whether the contract is currently paused
     * @return isPaused Whether the contract is currently paused
     * @return isAaveEnabled Whether Aave integration is currently enabled
     * @return isEmergencyWithdrawalEnabled Whether emergency withdrawals are enabled
     * @return reservePercentage Current emergency reserve percentage
     */
    function getContractStatusBasic(FundraiserStorage.State storage self, bool isPaused) external view returns (
        bool,
        bool,
        bool,
        uint256
    ) {
        return (
            isPaused,
            self.aaveEnabled,
            self.emergencyWithdrawalsEnabled,
            self.emergencyReservePercentage
        );
    }

    /**
     * @notice Check contract status - Part 2: Balance and accounting info
     * @return totalDeposits Total USDC deposited to Aave (in normal units)
     * @return contractUsdcBalance Current USDC balance in contract (in normal units)
     * @return availableYield Available yield that can be distributed (in normal units) 
     * @return isAccountingSafe Whether our internal accounting matches Aave balances
     */
    function getContractStatusBalances(FundraiserStorage.State storage self) external view returns (
        uint256,
        uint256,
        uint256,
        bool
    ) {
        // Total deposits in normal units
        uint256 totalDeposits = self.totalDeposited / self.USDC_DECIMAL_FACTOR;
        
        // Contract USDC balance in normal units
        uint256 contractUsdcBalance = IERC20(self.usdcAddress).balanceOf(address(this)) / self.USDC_DECIMAL_FACTOR;
        
        // Calculate available yield
        uint256 availableYield = 0;
        if (self.aaveEnabled) {
            try IERC20(self.aUsdcAddress).balanceOf(address(this)) returns (uint256 aUsdcBalance) {
                if (aUsdcBalance > self.totalDeposited) {
                    availableYield = (aUsdcBalance - self.totalDeposited) / self.USDC_DECIMAL_FACTOR;
                }
            } catch {
                // Keep default value of 0
            }
        }
        
        // Check accounting safety
        bool isAccountingSafe = true;
        if (self.aaveEnabled) {
            try IERC20(self.aUsdcAddress).balanceOf(address(this)) returns (uint256 aUsdcBalance) {
                isAccountingSafe = aUsdcBalance >= self.totalDeposited;
            } catch {
                isAccountingSafe = false;
            }
        }
        
        return (
            totalDeposits,
            contractUsdcBalance,
            availableYield,
            isAccountingSafe
        );
    }
} 