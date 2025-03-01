// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

//Install openzeppelin v4.9.6
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import {IPool} from "./interfaces/IPool.sol";
import {FundraiserStorage} from "./FundraiserStorage.sol";
import {AaveHelpers} from "./AaveHelpers.sol";
import {FundraiserLogic} from "./FundraiserLogic.sol";
import {AdminFunctions} from "./AdminFunctions.sol";
import {ViewFunctions} from "./ViewFunctions.sol";
import {AaveFunctions} from "./AaveFunctions.sol";

interface IAToken is IERC20 {
    function UNDERLYING_ASSET_ADDRESS() external view returns (address);
}

/**
 * @title FundraiserFactory
 * @notice This contract allows creation and management of fundraisers with USDC as the contribution token.
 * @dev This is a thin proxy contract that delegates most functionality to library implementations.
 *
 * Sepolia Test Addresses:
 * - USDC Address: 0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238
 * - Aave Pool Address: 0x6Ae43d3271ff6888e7Fc43Fd7321a503ff738951
 * - aUSDC Address: 0x16dA4541aD1807f4443d92D26044C1147406EB80
 */
contract FundraiserFactory is FundraiserStorage, Ownable, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;
    using ViewFunctions for FundraiserStorage.State;
    using AaveFunctions for FundraiserStorage.State;
    using AdminFunctions for FundraiserStorage.State;
    using FundraiserLogic for FundraiserStorage.Fundraiser;

    // Events
    event FundraiserCreated(uint256 indexed id, address indexed owner, uint256 goal);
    event Deposit(address indexed user, uint256 indexed id, uint256 amt);
    event Withdrawal(address indexed user, uint256 indexed fundraiserId, uint256 amount);
    event EmergencyWithdrawal(address indexed owner, uint256 amount);
    event EmergencyUserWithdrawal(address indexed user, uint256 indexed fundraiserId, uint256 amount);
    event EmergencyReservePercentageUpdated(uint256 newPercentage);
    event AaveEnabledStatusUpdated(bool enabled);
    event AaveWithdrawalFailed(uint256 requestedAmount, string reason);
    event AaveWithdrawal(uint256 amount, uint256 timestamp);
    event YieldDistributed(address indexed recipient, uint256 amount, uint256 timestamp);
    event EmergencyAaveWithdrawal(uint256 amount);
    event EmergencyWithdrawalsStatusChanged(bool enabled);
    event ContentAdded(bytes32 indexed contentHash, string description);

    // Create State variable for storage access
    FundraiserStorage.State private state;

    /**
     * @param _usdcAddress Address of the USDC contract (6 decimals) on your target network (e.g., Sepolia).
     * @param _aavePoolAddress Address of the Aave Pool contract.
     * @param _aUsdcAddress Address of the aUSDC token contract.
     *
     * For Sepolia testing:
     * _usdcAddress = 0x94a9D9AC8a22534E3FaCa9F4e7F2E2cf85d5E4C8
     * _aavePoolAddress = 0x6Ae43d3271ff6888e7Fc43Fd7321a503ff738951
     * _aUsdcAddress = 0x16dA4541aD1807f4443d92D26044C1147406EB22
     */
    constructor(address _usdcAddress, address _aavePoolAddress, address _aUsdcAddress) Ownable(msg.sender) {
        if (_usdcAddress == address(0)) revert InvalidAddress();
        if (_aavePoolAddress == address(0)) revert InvalidAddress();
        if (_aUsdcAddress == address(0)) revert InvalidAddress();

        // Initialize state variables
        state.usdcAddress = _usdcAddress;
        state.aavePoolAddress = _aavePoolAddress;
        state.aUsdcAddress = _aUsdcAddress;
        state.USDC_DECIMAL_FACTOR = USDC_DECIMAL_FACTOR;
        AaveFunctions.setEmergencyReservePercentage(state, 20);
        AaveFunctions.setAaveEnabled(state, true);
        require(_usdcAddress != address(0), "Invalid USDC address");
        usdcAddress = _usdcAddress;
    }

    // -----------------------------
    //  ADMIN FUNCTIONS
    // -----------------------------
    
    /**
     * @notice Pauses the contract, preventing donations and withdrawals
     */
    function pause() external onlyOwner {
        _pause();
    }
    
    /**
     * @notice Unpauses the contract, allowing donations and withdrawals
     */
    function unpause() external onlyOwner {
        _unpause();
    }
    
    /**
     * @notice Emergency function to withdraw all funds in case of critical issues
     * @param _recipient Address to receive the funds
     */
    function emergencyWithdraw(address _recipient) external onlyOwner {
        if (_recipient == address(0)) revert InvalidAddress();

        // First withdraw everything from Aave if enabled
        if (state.aaveEnabled && state.totalDeposited > 0) {
            AaveFunctions.withdrawFromAave(state, state.totalDeposited);
        }

        IERC20 usdc = IERC20(state.usdcAddress);
        uint256 balance = usdc.balanceOf(address(this));
        if (balance == 0) revert InvalidInput(1);
        
        usdc.safeTransfer(_recipient, balance);
        emit EmergencyWithdrawal(_recipient, balance);
    }

    // -----------------------------
    //  CREATE A FUNDRAISER
    // -----------------------------
    /**
     * @notice Adds a new fundraiser to the platform
     * @dev Creates a new fundraiser with the caller as owner. Stores content hashes and the actual
     *      content in the registry for efficient on-chain storage.
     * @param _endDate Timestamp when the fundraiser will end (must be in the future)
     * @param _subject Title or subject of the fundraiser
     * @param _additionalDetails Detailed description of the fundraiser
     * @param _initialAmountNeeded Target goal in normal USDC units (e.g., 1000 = 1000 USDC)
     */
    function addFundraiser(
        uint64 _endDate, 
        string calldata _subject, 
        string calldata _additionalDetails, 
        uint256 _initialAmountNeeded
    ) external whenNotPaused {
        if (_endDate <= block.timestamp) revert FundingPeriodEnded();
        if (_initialAmountNeeded == 0) revert InvalidInput(2);

        // Convert to base units with overflow protection
        uint256 baseUnitsNeeded = _initialAmountNeeded * state.USDC_DECIMAL_FACTOR;
        if (baseUnitsNeeded > type(uint128).max) revert InvalidInput(2);

        // Create hashes for storage efficiency
        bytes32 subjectHash = FundraiserLogic.createHash(_subject);
        bytes32 detailsHash = FundraiserLogic.createHash(_additionalDetails);

        uint256 fundraiserId = state.fundraiserEventCounter++;

        state.idToFundraiserEvent[fundraiserId] = Fundraiser({
            owner: msg.sender,
            startDate: uint64(block.timestamp),
            endDate: _endDate,
            fundraiserGoal: uint128(baseUnitsNeeded),
            amountRaised: uint128(0),
            claimedAmount: uint128(0),
            reserved: bytes16(0),
            subjectHash: subjectHash,
            detailsHash: detailsHash
        });

        // Store the actual content in the registry
        state.contentRegistry[subjectHash] = _subject;
        state.contentRegistry[detailsHash] = _additionalDetails;

        emit FundraiserCreated(fundraiserId, msg.sender, baseUnitsNeeded);
    }

    // -----------------------------
    //  RECORD A DEPOSIT
    // -----------------------------
    /**
     * @notice Record a donation to a fundraiser
     * @dev Transfers USDC from user to contract, updates accounting, and deposits to Aave if enabled.
     *      Uses Checks-Effects-Interactions pattern for security.
     * @param _fundraiserId ID of the fundraiser to donate to
     * @param _amount Amount to donate in normal USDC units (e.g., 10 = 10 USDC)
     */
    function recordDonation(uint256 _fundraiserId, uint256 _amount) external nonReentrant whenNotPaused {
        require(_fundraiserId <= state.fundraiserEventCounter, "Invalid fundraiser ID");
        require(_amount != 0, "Amount must be greater than 0");
        require(msg.sender != address(0), "Invalid sender address");
        
        Fundraiser storage theFundraiser = state.idToFundraiserEvent[_fundraiserId];
        
        // Ensure the funding window is still open and fundraiser is not completed
        require(block.timestamp < theFundraiser.endDate, "Must set an end date in the future");
        require(!FundraiserLogic.isFundraiserCompleted(theFundraiser), "Fundraiser is already completed");

        // Convert deposit to base units
        uint256 depositInBaseUnits = _amount * state.USDC_DECIMAL_FACTOR;
        require(uint256(theFundraiser.amountRaised) + depositInBaseUnits < type(uint128).max, "Amount raised would overflow");
        
        // Update contract's internal accounting (Checks-Effects pattern)
        state.userContributions[msg.sender][_fundraiserId] += depositInBaseUnits;
        theFundraiser.amountRaised += uint128(depositInBaseUnits);
        
        // Transfer USDC from the user to this contract (Interactions pattern)
        IERC20(state.usdcAddress).safeTransferFrom(msg.sender, address(this), depositInBaseUnits);
        
        emit Deposit(msg.sender, _fundraiserId, depositInBaseUnits);

        // Deposit to Aave if enabled
        if (state.aaveEnabled) {
            AaveFunctions.depositToAave(state, address(this));
        }
    }

    // -----------------------------
    //  WITHDRAW FUNDS (OWNER)
    // -----------------------------
    /**
     * @notice Withdraw funds from a fundraiser (for fundraiser owners)
     * @dev Owner can withdraw only if goal is reached OR funding period has ended.
     *      Uses Checks-Effects-Interactions pattern for security.
     * @param _fundraiserId ID of the fundraiser to withdraw from
     * @param _amount Amount to withdraw in normal USDC units
     */
    function withdraw(uint256 _fundraiserId, uint256 _amount) external nonReentrant whenNotPaused {
        if (_fundraiserId >= state.fundraiserEventCounter) revert InvalidInput(1);
        if (_amount == 0) revert InvalidInput(2);

        Fundraiser storage theFundraiser = state.idToFundraiserEvent[_fundraiserId];
        if (theFundraiser.owner != msg.sender) revert InvalidInput(2);
        
        // Calculate if goal reached
        bool goalReached = theFundraiser.amountRaised >= theFundraiser.fundraiserGoal;
        
        // Owner can withdraw only if goal reached OR funding period ended
        if (!goalReached && block.timestamp <= theFundraiser.endDate) {
            revert WithdrawalConditionsNotMet();
        }
        
        // Check if there's enough unclaimed balance
        uint256 withdrawAmount = _amount * state.USDC_DECIMAL_FACTOR;
        uint256 availableToWithdraw = theFundraiser.amountRaised - theFundraiser.claimedAmount;
        if (availableToWithdraw < withdrawAmount) revert InvalidInput(5);

        // Check if we need to withdraw from Aave
        uint256 contractBalance = IERC20(state.usdcAddress).balanceOf(address(this));
        if (contractBalance < withdrawAmount) {
            uint256 amountToWithdrawFromAave = withdrawAmount - contractBalance;
            AaveFunctions.withdrawFromAave(state, amountToWithdrawFromAave);

            // Check if we have enough after withdrawal
            contractBalance = IERC20(state.usdcAddress).balanceOf(address(this));
            if (contractBalance < withdrawAmount) revert InvalidInput(2);
        }

        // Process the withdrawal
        FundraiserLogic.processWithdrawal(theFundraiser, withdrawAmount, msg.sender, state.usdcAddress);

        emit Withdrawal(msg.sender, _fundraiserId, withdrawAmount);
    }

    // -----------------------------
    //  DELEGATED FUNCTIONS
    // -----------------------------

    // View Functions
    /**
     * @notice Get the total USDC (in normal USDC units) stored in this contract.
     */
    function getContractBalance() external view returns (uint256) {
        return state.getContractBalance();
    }

    /**
     * @notice Get the USDC balance (in normal USDC units) for a specific fundraiser.
     */
    function getBalanceOfFundraiser(uint256 _fundraiserId) external view returns (uint256) {
        return state.getBalanceOfFundraiser(_fundraiserId);
    }

    /**
     * @notice How much has a user contributed to a specific fundraiser (in normal units)?
     */
    function getUserContribution(address _user, uint256 _fundraiserId) external view returns (uint256) {
        return state.getUserContribution(_user, _fundraiserId);
    }

    /**
     * @notice Returns the entire `Fundraiser` struct for a given _fundraiserId,
     *         with amounts converted to normal USDC units (instead of base units).
     */
    function getFundraiser(uint256 _fundraiserId)
        external
        view
        returns (address, uint256, uint256, string memory, string memory, uint256, uint256, bool, bool)
    {
        return state.getFundraiser(_fundraiserId);
    }
    
    /**
     * @notice Helper to convert a normal USDC amount to base units (6 decimals).
     * @param _amount Normal USDC units, e.g. 10 => 10 USDC => 10,000,000 base units
     */
    function getAmountInBaseUnits(uint256 _amount) external view returns (uint256) {
        return _amount * state.USDC_DECIMAL_FACTOR;
    }

    // -----------------------------
    //  AAVE INTEGRATION FUNCTIONS
    // -----------------------------

    /**
     * @notice Calculate the available yield (in normal USDC units)
     * @return Available yield
     */
    function getAvailableYield() public view returns (uint256) {
        if (!state.aaveEnabled) return 0;

        return AaveHelpers.getAvailableYield(state.aUsdcAddress, address(this), state.totalDeposited)
            / state.USDC_DECIMAL_FACTOR;
    }

    /**
     * @notice Distributes yield generated from Aave deposits to a recipient
     * @dev Withdraws from Aave but doesn't reduce totalDeposited, creating an accounting difference
     *      that represents the yield. Only callable by contract owner.
     * @param _recipient Address to receive the yield
     * @param _amount Amount of yield to distribute in normal USDC units
     */
    function distributeYield(address _recipient, uint256 _amount) external onlyOwner nonReentrant {
        if (_recipient == address(0)) revert InvalidAddress();
        if (_amount == 0) revert InvalidInput(2);

        if (!AaveFunctions.distributeYield(state, _recipient, _amount)) revert InvalidInput(7);
        emit YieldDistributed(_recipient, _amount, block.timestamp);
    }

    /**
     * @notice Enable or disable Aave integration
     * @param _enabled Whether Aave integration is enabled
     */
    function setAaveEnabled(bool _enabled) external onlyOwner {
        AaveFunctions.setAaveEnabled(state, _enabled);
        emit AaveEnabledStatusUpdated(_enabled);
    }

    /**
     * @notice Update the emergency reserve percentage
     * @param _newPercentage New percentage (0-100)
     */
    function setEmergencyReservePercentage(uint256 _newPercentage) external onlyOwner {
        if (_newPercentage > 100) revert InvalidInput(4);
        AaveFunctions.setEmergencyReservePercentage(state, _newPercentage);
        emit EmergencyReservePercentageUpdated(_newPercentage);
    }

    /**
     * @notice Emergency function to withdraw all funds from Aave
     * @dev Uses multiple strategies to attempt recovery of funds in case of Aave issues.
     *      Updates internal accounting based on actual amounts withdrawn.
     */
    function emergencyWithdrawFromAave() external onlyOwner nonReentrant {
        uint256 amount = AaveFunctions.emergencyWithdrawFromAave(state);
        emit EmergencyAaveWithdrawal(amount);
    }

    // -----------------------------
    //  EMERGENCY USER WITHDRAWAL
    // -----------------------------
    /**
     * @notice Allows users to perform emergency withdrawals of their contributions
     * @dev Works even when the contract is paused if emergencyWithdrawalsEnabled is true
     * @param _fundraiserId ID of the fundraiser to withdraw from
     */
    function emergencyUserWithdraw(uint256 _fundraiserId) external nonReentrant {
        // This function works even when paused if emergencyWithdrawalsEnabled is true
        if (paused() && !state.emergencyWithdrawalsEnabled) revert InvalidInput(6);
        if (_fundraiserId >= state.fundraiserEventCounter) revert InvalidInput(1);

        Fundraiser storage theFundraiser = state.idToFundraiserEvent[_fundraiserId];

        // Use the FundraiserLogic library to process withdrawal
        uint256 withdrawAmount =
            FundraiserLogic.processEmergencyUserWithdraw(theFundraiser, state, msg.sender, _fundraiserId);

        if (withdrawAmount == 0) revert InvalidInput(5);

        // Check if we need to withdraw from Aave
        uint256 contractBalance = IERC20(state.usdcAddress).balanceOf(address(this));
        if (contractBalance < withdrawAmount) {
            uint256 amountToWithdrawFromAave = withdrawAmount - contractBalance;
            AaveFunctions.withdrawFromAave(state, amountToWithdrawFromAave);

            // Check if we have enough after withdrawal
            contractBalance = IERC20(state.usdcAddress).balanceOf(address(this));
            if (contractBalance < withdrawAmount) {
                // If not enough funds, adjust the withdrawal amount
                withdrawAmount = contractBalance;
            }
        }

        // Transfer funds
        IERC20(state.usdcAddress).safeTransfer(msg.sender, withdrawAmount);

        emit EmergencyUserWithdrawal(msg.sender, _fundraiserId, withdrawAmount);
    }

    // -----------------------------
    //  VIEW FUNCTIONS
    // -----------------------------
    /**
     * @notice Batch retrieval of multiple fundraisers for efficient data loading
     * @dev Limits batch size to prevent out-of-gas errors.
     *      Useful for frontends and UIs that need to display multiple fundraisers.
     * @param _fromId Starting fundraiser ID
     * @param _count Maximum number of fundraisers to return (capped at 50)
     * @return response A BatchResponse struct containing arrays of fundraiser data:
     *         owners, startDates, endDates, subjectHashes, detailsHashes,
     *         fundraiserGoals, amountsRaised, areCompleted, goalsReached
     */
    function batchGetFundraisers(uint256 _fromId, uint256 _count) external view returns (BatchResponse memory) {
        return state.batchGetFundraisers(_fromId, _count);
    }

    /**
     * @notice Check contract status - combines multiple status checks in one call
     * @return isPaused Whether the contract is currently paused
     * @return isAaveEnabled Whether Aave integration is currently enabled
     * @return isEmergencyWithdrawalEnabled Whether emergency withdrawals are enabled
     * @return reservePercentage Current emergency reserve percentage
     * @return totalDeposits Total USDC deposited to Aave (in normal units)
     * @return contractUsdcBalance Current USDC balance in contract (in normal units)
     * @return availableYield Available yield that can be distributed (in normal units)
     * @return isAccountingSafe Whether our internal accounting matches Aave balances
     */
    function getContractStatus()
        external
        view
        returns (
            bool isPaused,
            bool isAaveEnabled,
            bool isEmergencyWithdrawalEnabled,
            uint256 reservePercentage,
            uint256 totalDeposits,
            uint256 contractUsdcBalance,
            uint256 availableYield,
            bool isAccountingSafe
        )
    {
        // Using named return values to avoid stack depth issues
        isPaused = paused();
        return _getContractStatusInternal(isPaused);
    }

    /**
     * @dev Internal helper to avoid stack depth issues in getContractStatus
     */
    function _getContractStatusInternal(bool isPaused)
        private
        view
        returns (bool, bool, bool, uint256, uint256, uint256, uint256, bool)
    {
        // Get basic status info first
        (, bool isAaveEnabled, bool isEmergencyWithdrawalEnabled, uint256 reservePercentage) =
            state.getContractStatusBasic(isPaused);

        // Then get balance info
        (uint256 totalDeposits, uint256 contractUsdcBalance, uint256 availableYield, bool isAccountingSafe) =
            state.getContractStatusBalances();

        return (
            isPaused,
            isAaveEnabled,
            isEmergencyWithdrawalEnabled,
            reservePercentage,
            totalDeposits,
            contractUsdcBalance,
            availableYield,
            isAccountingSafe
        );
    }

    // -----------------------------
    //  HELPER FUNCTIONS
    // -----------------------------

    /**
     * @notice Checks how much USDC allowance this contract has from the user
     * @return The amount of USDC this contract is allowed to spend on behalf of msg.sender
     */
    function checkAllowance() external view returns (uint256) {
        IERC20 usdc = IERC20(state.usdcAddress);
        return usdc.allowance(msg.sender, address(this));
    }

    /**
     * @notice Helper function that returns the USDC contract address
     * @return The address of the USDC contract used by this FundraiserFactory
     */
    function getUSDCAddress() external view returns (address) {
        return state.usdcAddress;
    }

    /**
     * @notice Helps calculate the amount in base units for approvals
     * @param _amount Example amount in normal USDC units that would need approval
     * @return The amount in base units that should be used in the USDC approve() call
     */
    function getApprovalAmount(uint256 _amount) external view returns (uint256) {
        return _amount * state.USDC_DECIMAL_FACTOR;
    }
    
    /**
     * @notice Provides instructions on how to approve USDC for this contract
     * @return Instructions on how to perform the approval in Remix
     */
    function getApprovalInstructions() external view returns (string memory) {
        return string(
            abi.encodePacked(
            "To approve USDC spending in Remix:\n",
            "1. Go to the 'Deploy & Run' tab\n",
            "2. Select 'IERC20' from the contract dropdown\n",
                "3. Enter USDC address: ",
                FundraiserLogic.addressToString(state.usdcAddress),
                "\n",
            "4. Click 'At Address' to load the USDC contract\n",
            "5. Find the 'approve' function\n",
                "6. Enter this contract's address: ",
                FundraiserLogic.addressToString(address(this)),
                "\n",
            "7. Enter amount with 6 decimals (e.g. 10 USDC = 10000000)\n",
            "8. Click 'transact' to approve"
            )
        );
    }

    /**
     * @notice Checks if a user can perform an emergency withdrawal for a specific fundraiser
     * @param _fundraiserId ID of the fundraiser to check
     * @param _user Address of the user to check withdrawal eligibility for
     * @return possible Whether the user can withdraw
     * @return maxAmount Maximum amount the user can withdraw in normal USDC units
     */
    function canPerformEmergencyWithdrawal(uint256 _fundraiserId, address _user)
        external
        view
        returns (bool possible, uint256 maxAmount)
    {
        if (_fundraiserId >= state.fundraiserEventCounter) revert InvalidInput(1);

        Fundraiser storage theFundraiser = state.idToFundraiserEvent[_fundraiserId];
        return FundraiserLogic.canPerformEmergencyWithdrawal(theFundraiser, state, _user, _fundraiserId);
    }

    /**
     * @notice Registers content in the on-chain registry by its hash
     * @dev Used for efficient storage of fundraiser details. Only owner can register content
     *      to prevent spam or malicious content.
     * @param _hash The hash of the content (usually keccak256 hash)
     * @param _content The actual content string to store
     */
    function registerContent(bytes32 _hash, string calldata _content) external onlyOwner {
        state.contentRegistry[_hash] = _content;
        emit ContentAdded(_hash, _content);
    }

    /**
     * @notice Set whether emergency user withdrawals are enabled even during pause
     * @param _enabled Whether emergency withdrawals are enabled
     */
    function setEmergencyWithdrawalsEnabled(bool _enabled) external onlyOwner {
        AdminFunctions.setEmergencyWithdrawalsEnabled(state, _enabled);
        emit EmergencyWithdrawalsStatusChanged(_enabled);
    }
}
