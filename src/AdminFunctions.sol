// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IPool} from "./interfaces/IPool.sol";
import {FundraiserStorage} from "./FundraiserStorage.sol";

/**
 * @title AdminFunctions
 * @notice Библиотека административных функций для FundraiserFactory
 */
library AdminFunctions {
    using SafeERC20 for IERC20;
    
    /**
     * @notice Аварийная функция для вывода всех средств
     */
    function emergencyWithdraw(
        address usdcAddress,
        address aavePoolAddress,
        uint256 totalDeposited,
        bool aaveEnabled,
        address recipient
    ) external returns (uint256 balance) {
        if (recipient == address(0)) revert FundraiserStorage.InvalidAddress();
        
        // Сначала выводим всё из Aave, если включено
        if (aaveEnabled && totalDeposited > 0) {
            try IPool(aavePoolAddress).withdraw(
                usdcAddress,
                totalDeposited,
                address(this)
            ) {} catch {}
        }
        
        IERC20 usdc = IERC20(usdcAddress);
        balance = usdc.balanceOf(address(this));
        if (balance == 0) revert FundraiserStorage.InvalidInput(1);
        
        usdc.safeTransfer(recipient, balance);
        
        return balance;
    }
    
    /**
     * @notice Аварийное снятие средств из Aave
     */
    function emergencyWithdrawFromAave(
        address usdcAddress,
        address aavePoolAddress,
        address aUsdcAddress,
        uint256 totalDeposited
    ) external returns (uint256 amountWithdrawn) {
        if (totalDeposited == 0) return 0;
        
        try IPool(aavePoolAddress).withdraw(
            usdcAddress,
            type(uint256).max,
            address(this)
        ) returns (uint256 withdrawnAmount) {
            amountWithdrawn = withdrawnAmount;
        } catch {
            // Даже если вывод не удался, пробуем получить баланс aUSDC
            try IERC20(aUsdcAddress).balanceOf(address(this)) returns (uint256 aTokenBalance) {
                if (aTokenBalance > 0) {
                    // Пробуем вывести все aTokens
                    try IPool(aavePoolAddress).withdraw(
                        usdcAddress,
                        type(uint256).max,
                        address(this)
                    ) returns (uint256 redeemAmount) {
                        amountWithdrawn = redeemAmount;
                    } catch {
                        amountWithdrawn = 0;
                    }
                }
            } catch {
                amountWithdrawn = 0;
            }
        }
        
        return amountWithdrawn;
    }
    
    /**
     * @notice Распределяет доход, полученный от депозитов Aave, получателю
     */
    function distributeYield(
        address usdcAddress,
        address aavePoolAddress,
        address recipient,
        uint256 availableYield
    ) external returns (bool) {
        if (availableYield == 0) return false;
        
        uint256 contractBalanceBefore = IERC20(usdcAddress).balanceOf(address(this));
        
        if (contractBalanceBefore < availableYield) {
            // Необходимо вывести из Aave без уменьшения totalDeposited
            uint256 amountToWithdraw = availableYield - contractBalanceBefore;
            try IPool(aavePoolAddress).withdraw(
                usdcAddress, 
                amountToWithdraw, 
                address(this)
            ) {} catch {
                return false;
            }
        }
        
        // Переводим доход получателю
        IERC20(usdcAddress).safeTransfer(recipient, availableYield);
        
        return true;
    }
    
    /**
     * @notice Спасение случайно отправленных токенов ERC20
     */
    function rescueERC20(
        address tokenAddress,
        address recipient,
        uint256 amount
    ) external returns (bool) {
        IERC20(tokenAddress).safeTransfer(recipient, amount);
        return true;
    }
    
    /**
     * @notice Вывод случайно отправленного ETH
     */
    function withdrawEth(address payable recipient) external returns (bool) {
        uint256 balance = address(this).balance;
        (bool success, ) = recipient.call{value: balance}("");
        return success;
    }

    /**
     * @notice Enable or disable Aave integration
     * @param state The storage state
     * @param _enabled Whether Aave integration is enabled
     */
    function setAaveEnabled(FundraiserStorage.State storage state, bool _enabled) internal {
        state.aaveEnabled = _enabled;
    }

    /**
     * @notice Устанавливает флаг разрешения экстренных выводов пользователями даже во время паузы
     * @param state Указатель на хранилище состояния
     * @param _enabled Флаг разрешения экстренных выводов
     */
    function setEmergencyWithdrawalsEnabled(FundraiserStorage.State storage state, bool _enabled) internal {
        state.emergencyWithdrawalsEnabled = _enabled;
    }
}
