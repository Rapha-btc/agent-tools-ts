import {
  makeContractCall,
  broadcastTransaction,
  AnchorMode,
  PostConditionMode,
  uintCV,
  contractPrincipalCV,
  makeContractFungiblePostCondition,
  FungibleConditionCode,
  callReadOnlyFunction,
  cvToJSON,
  createAssetInfo,
} from "@stacks/transactions";
import {
  CONFIG,
  getNetwork,
  deriveChildAccount,
  getNextNonce,
} from "../utilities";
import {
  getTokenInfo,
  JING_CONTRACTS,
  calculateAskFees,
  getTokenDecimals,
} from "./utils-token-pairs";

interface AskDetails {
  ustx: number;
  amount: number;
  ftSender: string;
  tokenDecimals?: number;
}

async function getAskDetails(swapId: number): Promise<AskDetails> {
  const network = getNetwork(CONFIG.NETWORK);
  const { address } = await deriveChildAccount(
    CONFIG.NETWORK,
    CONFIG.MNEMONIC,
    CONFIG.ACCOUNT_INDEX
  );

  const result = await callReadOnlyFunction({
    contractAddress: JING_CONTRACTS.ASK.address,
    contractName: JING_CONTRACTS.ASK.name,
    functionName: "get-swap",
    functionArgs: [uintCV(swapId)],
    network,
    senderAddress: address,
  });

  const jsonResult = cvToJSON(result);
  if (!jsonResult.success) throw new Error("Failed to get ask details");

  return {
    ustx: parseInt(jsonResult.value.value.ustx.value),
    amount: parseInt(jsonResult.value.value.amount.value),
    ftSender: jsonResult.value.value["ft-sender"].value,
  };
}

async function cancelAsk(
  swapId: number,
  pair: string,
  accountIndex: number = 0
) {
  const tokenInfo = getTokenInfo(pair);
  if (!tokenInfo) {
    throw new Error(`Failed to get token info for pair: ${pair}`);
  }

  // Get token decimals
  const tokenDecimals = await getTokenDecimals(tokenInfo);
  const tokenSymbol = pair.split("-")[0];

  const network = getNetwork(CONFIG.NETWORK);
  const { address, key } = await deriveChildAccount(
    CONFIG.NETWORK,
    CONFIG.MNEMONIC,
    accountIndex
  );
  const nonce = await getNextNonce(CONFIG.NETWORK, address);

  console.log(`Preparing to cancel ask ${swapId} from account ${address}`);

  // Get ask details and validate ownership
  const askDetails = await getAskDetails(swapId);
  const regularTokenAmount = askDetails.amount / Math.pow(10, tokenDecimals);
  const fees = calculateAskFees(askDetails.amount);
  const regularFees = fees / Math.pow(10, tokenDecimals);

  // Calculate price per token
  const price = askDetails.ustx / askDetails.amount;
  const adjustedPrice = price * Math.pow(10, tokenDecimals - 6);

  console.log(`\nAsk details:`);
  console.log(`- Creator: ${askDetails.ftSender}`);
  console.log(`- Token decimals: ${tokenDecimals}`);
  console.log(
    `- Amount: ${regularTokenAmount} ${tokenSymbol} (${askDetails.amount} μ${tokenSymbol})`
  );
  console.log(
    `- STX price: ${askDetails.ustx / 1_000_000} STX (${askDetails.ustx} μSTX)`
  );
  console.log(`- Price per ${tokenSymbol}: ${adjustedPrice.toFixed(8)} STX`);
  console.log(
    `- Refundable fees: ${regularFees} ${tokenSymbol} (${fees} μ${tokenSymbol})`
  );
  console.log(`- Gas fee: ${10000 / 1_000_000} STX (${10000} μSTX)`);

  if (askDetails.ftSender !== address) {
    console.log(`\nError: Cannot cancel ask`);
    console.log(`- Your address: ${address}`);
    console.log(`- Required address: ${askDetails.ftSender}`);
    throw new Error(
      `Only the ask creator (${askDetails.ftSender}) can cancel this ask`
    );
  }

  const postConditions = [
    // Return fees from YANG contract (in FT)
    makeContractFungiblePostCondition(
      JING_CONTRACTS.ASK.address,
      JING_CONTRACTS.YANG.name,
      FungibleConditionCode.LessEqual,
      fees,
      createAssetInfo(
        tokenInfo.contractAddress,
        tokenInfo.contractName,
        tokenInfo.assetName
      )
    ),
    // Return FT amount from contract
    makeContractFungiblePostCondition(
      JING_CONTRACTS.ASK.address,
      JING_CONTRACTS.ASK.name,
      FungibleConditionCode.Equal,
      askDetails.amount,
      createAssetInfo(
        tokenInfo.contractAddress,
        tokenInfo.contractName,
        tokenInfo.assetName
      )
    ),
  ];

  console.log("\nPost Conditions:");
  console.log(`- Contract returns: ${regularTokenAmount} ${tokenSymbol}`);
  console.log(`- YANG contract returns up to: ${regularFees} ${tokenSymbol}`);

  const txOptions = {
    contractAddress: JING_CONTRACTS.ASK.address,
    contractName: JING_CONTRACTS.ASK.name,
    functionName: "cancel",
    functionArgs: [
      uintCV(swapId),
      contractPrincipalCV(tokenInfo.contractAddress, tokenInfo.contractName),
      contractPrincipalCV(
        JING_CONTRACTS.YANG.address,
        JING_CONTRACTS.YANG.name
      ),
    ],
    senderKey: key,
    validateWithAbi: true,
    network,
    anchorMode: AnchorMode.Any,
    postConditionMode: PostConditionMode.Deny,
    postConditions,
    nonce,
    fee: 10000,
  };

  try {
    console.log("\nCreating contract call...");
    const transaction = await makeContractCall(txOptions);
    console.log("Broadcasting transaction...");
    const broadcastResponse = await broadcastTransaction(transaction, network);
    console.log("Transaction broadcast successfully!");
    console.log("Transaction ID:", broadcastResponse.txid);
    console.log(
      `Monitor status at: https://explorer.stacks.co/txid/${broadcastResponse.txid}`
    );
    return broadcastResponse;
  } catch (error: unknown) {
    if (error instanceof Error) {
      console.error(`Error cancelling ask: ${error.message}`);
    } else {
      console.error("An unknown error occurred while cancelling ask");
    }
    throw error;
  }
}

// Parse command line arguments
const [swapId, pair, accountIndex] = process.argv.slice(2);

if (!swapId || !pair) {
  console.error("\nUsage:");
  console.error(
    "bun run src/jing/cancel-ask.ts <swap_id> <pair> [account_index]"
  );
  console.error("\nParameters:");
  console.error("- swap_id: ID of the ask to cancel");
  console.error("- pair: Trading pair (e.g., PEPE-STX)");
  console.error(
    "- account_index: (Optional) Account index to use, defaults to 0"
  );
  console.error("\nExample:");
  console.error("bun run src/jing/cancel-ask.ts 10 PEPE-STX");
  console.error("");
  process.exit(1);
}

cancelAsk(parseInt(swapId), pair, accountIndex ? parseInt(accountIndex) : 0)
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(
      "\nError:",
      error instanceof Error ? error.message : "Unknown error"
    );
    process.exit(1);
  });