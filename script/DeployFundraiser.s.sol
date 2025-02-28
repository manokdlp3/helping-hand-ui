// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

import {Script} from "forge-std/Script.sol";
import {FundraiserFactory} from "../src/FundraiserFactory.sol";

contract DeployFundraiser is Script {
    function run() public returns (FundraiserFactory) {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");

        // Адреса контрактов на Sepolia
        address USDC_ADDRESS = 0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238;
        address AAVE_POOL = 0x6Ae43d3271ff6888e7Fc43Fd7321a503ff738951;
        address AAVE_DATA_PROVIDER = 0x16dA4541aD1807f4443d92D26044C1147406EB80;

        // Адреса уже развернутых библиотек
        address FUNDRAISER_LOGIC_ADDRESS = 0x5E8D2A9b0FDCA959236B4B72844902CFa0B1E7C4;
        address VIEW_FUNCTIONS_ADDRESS = 0x1A4045D7e2e753C9fEe5562f55E60D89BbD7B383;
        address ADMIN_FUNCTIONS_ADDRESS = 0x918221C00F792906d2386Befa5e40D116Fb5FfA0;
        address AAVE_FUNCTIONS_ADDRESS = 0xD0EF412bB84364a93DeC76A755468E9aC11aD211;
        address AAVE_HELPERS_ADDRESS = 0x5411804aD298f64C453907ed540595159c001369;

        vm.startBroadcast(deployerPrivateKey);

        // Развертывание основного контракта
        FundraiserFactory fundraiserFactory = new FundraiserFactory(USDC_ADDRESS, AAVE_POOL, AAVE_DATA_PROVIDER);

        vm.stopBroadcast();

        return fundraiserFactory;
    }
}
