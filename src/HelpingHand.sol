// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

// USDC Sepolia address for testing: 0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238

contract HelpingHandFactory {
    // Variables to deploy a helping hand contract

    struct hand {
        address owner;
        uint startDate;
        uint endDate;
        string subject;
        string additionalDetails;
        uint initialAmountNeeded;
        uint currentBalance;
    }

    // Non-user defined variables
    uint helpingHandIdCounter = 0;

    IERC20 public immutable usdc;
    address usdcAddress;

    // Events
    event Deposit(address indexed user, uint256 amount);
    event Withdrawal(address indexed user, uint256 amount);

    // Mappings
    mapping(uint256 helpingHandId => hand helpingHand) public idToHand; // tracks balances a hand proposal has
    mapping(address => uint256) public balances; // tracks the balance contributed by a user

    constructor(address _usdcAddress) { // Depending on the network we deploy it will have a different USDC contract address so specify in the constructor
        require(_usdcAddress != address(0), "Invalid USDC address");
        usdcAddress = _usdcAddress;
        usdc = IERC20(_usdcAddress);
    }

    // functions in the helping hand contract
    function addHelpingHand (uint _endDate, string memory _subject, string memory _additionalDetails, uint _initialAmountNeeded) external {
        // Create a "hand" struct
        hand memory helpingHand = hand({owner: msg.sender, startDate: block.timestamp, endDate: _endDate, subject: _subject, additionalDetails: _additionalDetails, initialAmountNeeded: _initialAmountNeeded, currentBalance: 0});
        idToHand[helpingHandIdCounter] = helpingHand;
        helpingHandIdCounter++; // iterate the id 1 now that it has been used
    }

    function deposit(uint8 _helpingHandId, uint8 _amount) external {
        require(_amount > 0, "Amount must be greater than 0");
        require(usdc.balanceOf(msg.sender) >= _amount, "USDC balance must be greater than the sending amount");
        
        // Transfer USDC from sender to this contract (requires prior approval)
        require(usdc.transferFrom(msg.sender, address(this), _amount), "Transfer failed");

        // Update the balance of the person calling the contract
        // This mapping adds to the total amount of USDC an address has on the contract
        balances[msg.sender] += _amount;
        // Update the balance in the hand struct
        // This is the balance each proposal has
        idToHand[_helpingHandId].currentBalance += _amount;

        emit Deposit(msg.sender, _amount);
    }


    function withdraw(uint _helpingHandId, uint _amount) external {
        require(_amount > 0, "Amount must be greater than 0");
        //require(balances[msg.sender] >= amount, "Insufficient balance");  
        require(idToHand[_helpingHandId].owner == msg.sender); // Require the hand owner is the person calling withdraw

        // Subtract balance form the addresses that added funds to that proposal
        // More complex than taking an amount from msg.sender
        // Subtract amount from the multiple senders which could have funded a hand
        //balances[msg.sender] -= amount;

        // remove the funds from the balance of the hand
        idToHand[_helpingHandId].currentBalance -= _amount;

        // Transfer USDC back to the user
        require(usdc.transfer(msg.sender, _amount), "Transfer failed");

        emit Withdrawal(msg.sender, _amount);
    }

    function getContractBalance() external view returns (uint256) {
        return usdc.balanceOf(address(this));
    }

    function getBalanceOfHand(uint _helpingHandId) external view returns (uint256) {
        // Takes in the ID of a hand and returns the balance
        return idToHand[_helpingHandId].currentBalance;
    }

}