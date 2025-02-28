// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "./FundraiserStorage.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title FundraiserLogic
 * @notice Core business logic for FundraiserFactory
 */
library FundraiserLogic {
    using SafeERC20 for IERC20;

    /**
     * @notice Internal optimized version of isFundraiserCompleted
     * @param fundraiser The fundraiser struct to check
     * @return True if the fundraiser is completed
     */
    function isFundraiserCompleted(FundraiserStorage.Fundraiser storage fundraiser) internal view returns (bool) {
        // Check if there are any funds raised first
        if (fundraiser.amountRaised == 0) {
            // No funds raised yet, so not completed
            return false;
        }

        // Check if all funds have been claimed
        if (fundraiser.claimedAmount >= fundraiser.amountRaised) {
            return true;
        }

        // Check if failed (ended without reaching goal)
        return (block.timestamp > fundraiser.endDate && fundraiser.amountRaised < fundraiser.fundraiserGoal);
    }

    /**
     * @notice Processes the withdrawal for fundraiser owner
     */
    function processWithdrawal(
        FundraiserStorage.Fundraiser storage theFundraiser,
        uint256 withdrawAmount,
        address recipient,
        address usdcAddress
    ) internal {
        // Update state before external calls
        theFundraiser.claimedAmount += uint128(withdrawAmount);

        // Transfer from this contract's USDC balance to the recipient
        IERC20(usdcAddress).safeTransfer(recipient, withdrawAmount);
    }

    /**
     * @notice Creates a content hash from a string
     */
    function createHash(string memory content) public pure returns (bytes32) {
        return keccak256(abi.encodePacked(content));
    }

    /**
     * @notice Helper function to convert an address to a string
     */
    function addressToString(address _addr) public pure returns (string memory) {
        bytes32 value = bytes32(uint256(uint160(_addr)));
        bytes memory alphabet = "0123456789abcdef";

        bytes memory str = new bytes(42);
        str[0] = "0";
        str[1] = "x";

        for (uint256 i = 0; i < 20; i++) {
            str[2 + i * 2] = alphabet[uint8(value[i + 12] >> 4)];
            str[3 + i * 2] = alphabet[uint8(value[i + 12] & 0x0f)];
        }

        return string(str);
    }

    /**
     * @notice Determines if a user can perform an emergency withdrawal
     */
    function canPerformEmergencyWithdrawal(
        FundraiserStorage.Fundraiser storage theFundraiser,
        FundraiserStorage.State storage state,
        address user,
        uint256 fundraiserId
    ) external view returns (bool possible, uint256 maxAmount) {
        uint256 userContribution = state.userContributions[user][fundraiserId];

        if (userContribution == 0) return (false, 0);

        // Check if the fundraiser is completed or all funds withdrawn
        if (theFundraiser.claimedAmount >= theFundraiser.amountRaised) return (false, 0);

        // Calculate the maximum allowed withdrawal amount
        uint256 availableFunds = theFundraiser.amountRaised - theFundraiser.claimedAmount;
        uint256 withdrawAmount = userContribution <= availableFunds ? userContribution : availableFunds;

        return (true, withdrawAmount / state.USDC_DECIMAL_FACTOR);
    }

    /**
     * @notice Processes emergency withdrawal by a user
     */
    function processEmergencyUserWithdraw(
        FundraiserStorage.Fundraiser storage theFundraiser,
        FundraiserStorage.State storage state,
        address user,
        uint256 fundraiserId
    ) external returns (uint256 withdrawAmount) {
        uint256 userContribution = state.userContributions[user][fundraiserId];

        // Calculate the maximum allowed withdrawal amount
        uint256 availableFunds = theFundraiser.amountRaised - theFundraiser.claimedAmount;
        withdrawAmount = userContribution <= availableFunds ? userContribution : availableFunds;

        // Update state
        state.userContributions[user][fundraiserId] -= withdrawAmount;
        theFundraiser.amountRaised = uint128(uint256(theFundraiser.amountRaised) - withdrawAmount);

        return withdrawAmount;
    }
}
