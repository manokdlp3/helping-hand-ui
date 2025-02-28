// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "forge-std/Test.sol";
import {FundraiserFactory} from "../src/FundraiserFactory.sol";

contract FundraiserFactoryTest is Test {
    FundraiserFactory public fundraiserFactory;
    address public owner;
    address public constant USDC_ADDRESS = address(0x1234); // Mock USDC address
    uint256 constant USDC_DECIMALS = 6;
    
    function setUp() public {
        owner = address(this);
        fundraiserFactory = new FundraiserFactory(USDC_ADDRESS);
    }

    function testAddFundraiser() public {
        string memory subject = "Test Fundraiser";
        string memory details = "Test description";
        uint64 endDate = uint64(block.timestamp + 7 days);
        uint256 goal = 1000 * 10**USDC_DECIMALS; // 1000 USDC with 6 decimals

        fundraiserFactory.addFundraiser(
            endDate,
            subject,
            details,
            goal
        );

        // Get the fundraiser details
        (
            address fOwner,
            ,  // startDate
            uint256 fEndDate,
            string memory fSubject,
            string memory fDetails,
            uint256 fGoal,
            uint256 amountRaised,
            ,  // isCompleted
            bool goalReached
        ) = fundraiserFactory.getFundraiser(0);

        assertEq(fOwner, address(this));
        assertEq(fEndDate, endDate);
        assertEq(fSubject, subject);
        assertEq(fDetails, details);
        assertEq(fGoal, goal);
        assertEq(amountRaised, 0);
        assertEq(goalReached, false);
    }

    function testAddFundraiserWithInvalidEndDate() public {
        // Test with end date in the past
        // Use a safe way to get past timestamp to avoid underflow
        vm.warp(1000000); // Start at a known timestamp
        uint64 pastEndDate = uint64(block.timestamp - 1 days);
        
        vm.expectRevert("End date must be in the future");
        fundraiserFactory.addFundraiser(
            pastEndDate,
            "Test Fundraiser",
            "Test description",
            1000 * 10**USDC_DECIMALS
        );
    }

    function testRecordDonation() public {
        // Start at a known timestamp
        vm.warp(1000000);
        
        // Create a fundraiser with a definite future end date
        uint64 endDate = uint64(block.timestamp + 7 days);
        uint256 fundraiserGoal = 1000 * 10**USDC_DECIMALS; // 1000 USDC with 6 decimals
        
        fundraiserFactory.addFundraiser(
            endDate,
            "Test Fundraiser",
            "Test description",
            fundraiserGoal
        );

        // Get fundraiser details and verify state
        (
            ,  // fOwner
            ,  // startDate
            uint256 fEndDate,
            ,  // subject
            ,  // details
            uint256 fGoal,
            uint256 amountRaised,
            bool isCompleted,
            bool goalReached
        ) = fundraiserFactory.getFundraiser(0);

        // Debug assertions
        assertEq(block.timestamp < fEndDate, true, "End date should be in future");
        assertEq(amountRaised < fGoal, true, "Should not have reached goal");
        assertEq(amountRaised, 0, "Should start with 0 raised");
        assertEq(goalReached, false, "Goal should not be reached");
        assertEq(isCompleted, false, "Should not be completed");

        // Mock USDC token approval and transfer
        MockUSDC mockUSDC = new MockUSDC();
        vm.etch(USDC_ADDRESS, address(mockUSDC).code);
        
        // Make donation (100 USDC with 6 decimals)
        uint256 donationAmount = 100 * 10**USDC_DECIMALS;
        
        fundraiserFactory.recordDonation(0, donationAmount);

        // Check the donation was recorded
        assertEq(fundraiserFactory.getUserContribution(address(this), 0), donationAmount);
    }

    function testRecordDonationWithInvalidAmount() public {
        uint64 endDate = uint64(block.timestamp + 7 days);
        fundraiserFactory.addFundraiser(
            endDate,
            "Test Fundraiser",
            "Test description",
            1000 * 10**USDC_DECIMALS
        );

        // Update to match contract's error message
        vm.expectRevert("Amount must be greater than 0");
        fundraiserFactory.recordDonation(0, 0);
    }

    function testRecordDonationAfterEndDate() public {
        // Create fundraiser
        uint64 endDate = uint64(block.timestamp + 7 days);
        fundraiserFactory.addFundraiser(
            endDate,
            "Test Fundraiser",
            "Test description",
            1000 * 10**USDC_DECIMALS
        );

        // Warp time to after end date
        vm.warp(endDate + 1);

        // Update to match contract's error message
        vm.expectRevert("Funding period has ended");
        fundraiserFactory.recordDonation(0, 100 * 10**USDC_DECIMALS);
    }

    function testGoalReachedStatus() public {
        uint256 fundraiserGoal = 1000 * 10**USDC_DECIMALS;
        
        // Start at a known timestamp
        vm.warp(1000000);
        
        fundraiserFactory.addFundraiser(
            uint64(block.timestamp + 7 days),
            "Test Fundraiser",
            "Test description",
            fundraiserGoal
        );

        // Setup mock USDC
        MockUSDC mockUSDC = new MockUSDC();
        vm.etch(USDC_ADDRESS, address(mockUSDC).code);
        
        // Make donation that reaches the goal
        fundraiserFactory.recordDonation(0, fundraiserGoal);

        // Verify goal reached status
        (,,,,,,, bool isCompleted, bool goalReached) = fundraiserFactory.getFundraiser(0);
        assertEq(goalReached, true, "Goal should be marked as reached");
        // Remove this assertion since completion is based on claimed amounts
        // assertEq(isCompleted, true, "Fundraiser should be marked as completed");
    }
}

// Update MockUSDC to handle decimals
contract MockUSDC {
    function transferFrom(address, address, uint256) public pure returns (bool) {
        return true;
    }

    function approve(address, uint256) public pure returns (bool) {
        return true;
    }

    function balanceOf(address) public pure returns (uint256) {
        return type(uint256).max;
    }

    function allowance(address, address) public pure returns (uint256) {
        return type(uint256).max;
    }

    function decimals() public pure returns (uint8) {
        return 6;
    }
}
