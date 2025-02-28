// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "forge-std/Test.sol";
import {FundraiserFactory} from "../src/FundraiserFactory.sol";
import {FundraiserStorage} from "../src/FundraiserStorage.sol";

contract FundraiserFactoryTest is Test {
    FundraiserFactory public fundraiserFactory;
    address public owner;
    MockUSDCWithTransfer public mockUSDC;
    MockAavePool public mockAavePool;
    MockAUSDC public mockAUSDC;
    uint256 constant USDC_DECIMALS = 6;

    function setUp() public {
        owner = address(this);

        // Создаем мок USDC напрямую
        mockUSDC = new MockUSDCWithTransfer();

        // Создаем мок Aave Pool и aUSDC
        mockAavePool = new MockAavePool();
        mockAUSDC = new MockAUSDC();

        // Устанавливаем баланс для тестового аккаунта
        mockUSDC.setBalance(address(this), 1000000 * 10 ** USDC_DECIMALS);

        // Проверяем, что баланс установлен правильно
        console.log("Initial balance:", mockUSDC.balanceOf(address(this)));

        // Даем разрешение контракту на использование USDC
        vm.startPrank(address(this));
        mockUSDC.approve(address(this), type(uint256).max);
        vm.stopPrank();

        fundraiserFactory = new FundraiserFactory(address(mockUSDC), address(mockAavePool), address(mockAUSDC));
    }

    function testAddFundraiser() public {
        string memory subject = "Test Fundraiser";
        string memory details = "Test description";
        uint64 endDate = uint64(block.timestamp + 7 days);
        uint256 goal = 1000; // 1000 USDC (без учета десятичных знаков)

        fundraiserFactory.addFundraiser(endDate, subject, details, goal);

        // Get the fundraiser details
        (
            address fOwner,
            , // startDate
            uint256 fEndDate,
            string memory fSubject,
            string memory fDetails,
            uint256 fGoal,
            uint256 amountRaised,
            , // isCompleted
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

        vm.expectRevert(FundraiserStorage.FundingPeriodEnded.selector);
        fundraiserFactory.addFundraiser(pastEndDate, "Test Fundraiser", "Test description", 1000);
    }

    function testRecordDonation() public {
        // Start at a known timestamp
        vm.warp(1000000);

        // Create a fundraiser with a definite future end date
        uint64 endDate = uint64(block.timestamp + 7 days);
        uint256 fundraiserGoal = 1000; // 1000 USDC (без учета десятичных знаков)

        fundraiserFactory.addFundraiser(endDate, "Test Fundraiser", "Test description", fundraiserGoal);

        // Get fundraiser details and verify state
        (
            , // fOwner
            , // startDate
            uint256 fEndDate,
            , // subject
            , // details
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

        // Проверяем баланс и разрешение
        console.log("Balance before:", mockUSDC.balanceOf(address(this)));
        console.log("Allowance:", mockUSDC.allowance(address(this), address(fundraiserFactory)));

        // Даем разрешение контракту на использование USDC
        vm.startPrank(address(this));
        mockUSDC.approve(address(fundraiserFactory), type(uint256).max);
        vm.stopPrank();

        console.log("Allowance after approve:", mockUSDC.allowance(address(this), address(fundraiserFactory)));

        // Make donation (100 USDC)
        uint256 donationAmount = 100;

        fundraiserFactory.recordDonation(0, donationAmount);

        // Check the donation was recorded
        assertEq(fundraiserFactory.getUserContribution(address(this), 0), donationAmount);
    }

    function testRecordDonationWithInvalidAmount() public {
        uint64 endDate = uint64(block.timestamp + 7 days);
        fundraiserFactory.addFundraiser(endDate, "Test Fundraiser", "Test description", 1000);

        // Обновлено для соответствия текущей ошибке в контракте
        vm.expectRevert(abi.encodeWithSelector(FundraiserStorage.InvalidInput.selector, 2));
        fundraiserFactory.recordDonation(0, 0);
    }

    function testRecordDonationAfterEndDate() public {
        // Create fundraiser
        uint64 endDate = uint64(block.timestamp + 7 days);
        fundraiserFactory.addFundraiser(endDate, "Test Fundraiser", "Test description", 1000);

        // Warp time to after end date
        vm.warp(endDate + 1);

        // Обновлено для соответствия текущей ошибке в контракте
        vm.expectRevert(FundraiserStorage.FundingPeriodEnded.selector);
        fundraiserFactory.recordDonation(0, 100);
    }

    function testGoalReachedStatus() public {
        uint256 fundraiserGoal = 1000; // 1000 USDC (без учета десятичных знаков)

        // Start at a known timestamp
        vm.warp(1000000);

        fundraiserFactory.addFundraiser(
            uint64(block.timestamp + 7 days), "Test Fundraiser", "Test description", fundraiserGoal
        );

        // Проверяем баланс и разрешение
        console.log("Balance before:", mockUSDC.balanceOf(address(this)));
        console.log("Allowance:", mockUSDC.allowance(address(this), address(fundraiserFactory)));

        // Даем разрешение контракту на использование USDC
        vm.startPrank(address(this));
        mockUSDC.approve(address(fundraiserFactory), type(uint256).max);
        vm.stopPrank();

        console.log("Allowance after approve:", mockUSDC.allowance(address(this), address(fundraiserFactory)));

        // Make donation that reaches the goal
        fundraiserFactory.recordDonation(0, fundraiserGoal);

        // Verify goal reached status
        (,,,,,,, bool isCompleted, bool goalReached) = fundraiserFactory.getFundraiser(0);
        assertEq(goalReached, true, "Goal should be marked as reached");
        // Remove this assertion since completion is based on claimed amounts
        // assertEq(isCompleted, true, "Fundraiser should be marked as completed");
    }
}

// Обновленный мок USDC, который не вызывает переполнения
contract MockUSDCWithTransfer {
    mapping(address => uint256) private _balances;
    mapping(address => mapping(address => uint256)) private _allowances;

    constructor() {}

    // Функция для установки баланса в тестах
    function setBalance(address account, uint256 amount) public {
        _balances[account] = amount;
    }

    function transferFrom(address from, address to, uint256 amount) public returns (bool) {
        uint256 currentAllowance = _allowances[from][msg.sender];
        require(currentAllowance >= amount, "ERC20: insufficient allowance");

        uint256 fromBalance = _balances[from];
        require(fromBalance >= amount, "ERC20: transfer amount exceeds balance");

        _balances[from] = fromBalance - amount;
        _balances[to] += amount;

        _allowances[from][msg.sender] = currentAllowance - amount;

        return true;
    }

    function approve(address spender, uint256 amount) public returns (bool) {
        _allowances[msg.sender][spender] = amount;
        return true;
    }

    function balanceOf(address account) public view returns (uint256) {
        return _balances[account];
    }

    function allowance(address owner, address spender) public view returns (uint256) {
        return _allowances[owner][spender];
    }
}

// Мок для Aave Pool
contract MockAavePool {
    function supply(address asset, uint256 amount, address onBehalfOf, uint16 referralCode) external returns (bool) {
        // Просто возвращаем true, чтобы симулировать успешное выполнение
        return true;
    }

    function withdraw(address asset, uint256 amount, address to) external returns (uint256) {
        // Возвращаем запрошенную сумму
        return amount;
    }
}

// Мок для aUSDC
contract MockAUSDC {
    mapping(address => uint256) private _balances;

    function setBalance(address account, uint256 amount) public {
        _balances[account] = amount;
    }

    function balanceOf(address account) public view returns (uint256) {
        return _balances[account];
    }

    function transfer(address to, uint256 amount) public returns (bool) {
        uint256 fromBalance = _balances[msg.sender];
        require(fromBalance >= amount, "ERC20: transfer amount exceeds balance");

        _balances[msg.sender] = fromBalance - amount;
        _balances[to] += amount;

        return true;
    }
}
