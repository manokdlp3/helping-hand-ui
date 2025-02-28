// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/**
 * @title FundraiserStorage
 * @notice Storage contract for FundraiserFactory
 */
contract FundraiserStorage {
    // Define the State struct that's referenced in other libraries
    struct State {
        // Add all storage variables here
        address usdcAddress;
        address aavePoolAddress;
        address aUsdcAddress;
        uint256 USDC_DECIMAL_FACTOR;
        uint256 fundraiserEventCounter;
        uint256 totalDeposited;
        uint256 emergencyReservePercentage;
        bool aaveEnabled;
        bool emergencyWithdrawalsEnabled;
        mapping(uint256 => Fundraiser) idToFundraiserEvent;
        mapping(address => mapping(uint256 => uint256)) userContributions;
        mapping(bytes32 => string) contentRegistry;
    }

    // Structure and storage for fundraiser data
    struct Fundraiser {
        address owner;
        uint64 startDate;
        uint64 endDate;
        uint128 fundraiserGoal;
        uint128 amountRaised;
        uint128 claimedAmount;
        bytes16 reserved;
        bytes32 subjectHash;
        bytes32 detailsHash;
    }

    struct BatchResponse {
        address[] owners;
        uint256[] startDates;
        uint256[] endDates;
        bytes32[] subjectHashes;
        bytes32[] detailsHashes;
        uint256[] fundraiserGoals;
        uint256[] amountsRaised;
        bool[] areCompleted;
        bool[] goalsReached;
    }

    // Error definitions
    error InvalidInput(uint8 code);
    error InvalidAddress();
    error FundingPeriodEnded();
    error WithdrawalConditionsNotMet();
    error PercentageOutOfRange();

    // ID counter for newly created fundraisers
    uint256 internal fundraiserEventCounter;

    // Mappings
    mapping(uint256 => Fundraiser) internal idToFundraiserEvent;
    mapping(address => mapping(uint256 => uint256)) internal userContributions;
    mapping(bytes32 => string) internal contentRegistry;

    // Constants
    uint8 internal constant USDC_DECIMALS = 6;
    uint256 internal constant USDC_DECIMAL_FACTOR = 10 ** USDC_DECIMALS;

    // Address of the USDC token contract
    address internal usdcAddress;

    // Aave integration variables
    address internal aavePoolAddress;
    address internal aUsdcAddress;
    uint256 internal emergencyReservePercentage;
    bool internal aaveEnabled;
    uint256 internal totalDeposited;

    // Flag to allow emergency withdrawals even when paused
    bool internal emergencyWithdrawalsEnabled;
}
