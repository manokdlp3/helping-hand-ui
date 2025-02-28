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
