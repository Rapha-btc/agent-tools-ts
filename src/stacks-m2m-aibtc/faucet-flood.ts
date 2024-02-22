import {
  AnchorMode,
  Cl,
  PostConditionMode,
  SignedContractCallOptions,
  broadcastTransaction,
  getNonce,
  makeContractCall,
} from "@stacks/transactions";
import { deriveChildAccount } from "../utilities";
import { DEPLOYER, TOKEN_CONTRACT_NAME } from "../constants";

// get 100_000_000 aiBTC from the faucet

// CONFIGURATION

const NETWORK = Bun.env.network;
const MNEMONIC = Bun.env.mnemonic;
const ACCOUNT_INDEX = Bun.env.accountIndex;

const DEFAULT_FEE = 250_000; // 0.25 STX
const FUNCTION_NAME = "faucet-flood";

// MAIN SCRIPT (DO NOT EDIT BELOW)

async function main() {
  // get account info from env
  const network = NETWORK;
  const mnemonic = MNEMONIC;
  const accountIndex = ACCOUNT_INDEX;

  // get account address and private key
  const { address, key } = await deriveChildAccount(
    network,
    mnemonic,
    accountIndex
  );

  // set target as current account index
  const FUNCTION_ARGS = [Cl.principal(address)];

  // get the current nonce for the account
  const nonce = await getNonce(address, network);

  // create the pay-invoice transaction
  const txOptions: SignedContractCallOptions = {
    contractAddress: DEPLOYER,
    contractName: TOKEN_CONTRACT_NAME,
    functionName: FUNCTION_NAME,
    functionArgs: FUNCTION_ARGS,
    fee: DEFAULT_FEE,
    nonce: nonce,
    network: network,
    senderKey: key,
    anchorMode: AnchorMode.Any,
    postConditionMode: PostConditionMode.Deny,
    postConditions: [],
  };

  try {
    // create and broadcast transaction
    const transaction = await makeContractCall(txOptions);
    const broadcastResponse = await broadcastTransaction(transaction, network);

    // handle error in response
    if ("error" in broadcastResponse) {
      console.error("Transaction failed to broadcast");
      console.error(`Error: ${broadcastResponse.error}`);
      if (broadcastResponse.reason) {
        console.error(`Reason: ${broadcastResponse.reason}`);
      }
      if (broadcastResponse.reason_data) {
        console.error(
          `Reason Data: ${JSON.stringify(
            broadcastResponse.reason_data,
            null,
            2
          )}`
        );
      }
    } else {
      // report successful result
      console.log("Transaction broadcasted successfully!");
      console.log(`FROM: ${address}`);
      console.log(`TXID: 0x${broadcastResponse.txid}`);
    }
  } catch (error) {
    // report error
    console.error(`General/Unexpected Failure: ${error}`);
  }
}

main();
