import { Inscription } from "ordinalsbot";
import {
  CONFIG,
  createErrorResponse,
  sendToLLM,
  ToolResponse,
} from "../utilities";

// Constants
const SUPPLY = 1_000_000_000;
const standardFile = {
  name: "rune.txt",
  size: 1,
  type: "plain/text",
  dataURL: "data:plain/text;base64,YQ==",
};

const usage =
  "Usage: bun run src/btc-runes/etch-runes.ts <rune_name> <symbol> [network]";
const usageExample =
  'Example: bun run src/btc-runes/etch-runes.ts "FAKTORY•TOKEN" "K" testnet';

// Types
interface ExpectedArgs {
  runeName: string;
  runeSymbol: string;
  network: "testnet" | "mainnet";
}

function validateArgs(): ExpectedArgs {
  const [runeName, runeSymbol, network = "testnet"] = process.argv.slice(2);

  if (!runeName || !runeSymbol) {
    const errorMessage = [
      `Invalid arguments: ${process.argv.slice(2).join(" ")}`,
      usage,
      usageExample,
    ].join("\n");
    throw new Error(errorMessage);
  }

  if (runeSymbol.length !== 1) {
    throw new Error("Symbol must be a single character");
  }

  if (network !== "testnet" && network !== "mainnet") {
    throw new Error("Network must be either 'testnet' or 'mainnet'");
  }

  return {
    runeName,
    runeSymbol,
    network,
  };
}

async function main(): Promise<ToolResponse<string>> {
  // Validate environment variables
  const API_KEY = process.env.ORDINALSBOT_API_KEY;
  const RECEIVE_ADDRESS = process.env.RECEIVE_ADDRESS;

  if (!API_KEY) {
    throw new Error("ORDINALSBOT_API_KEY environment variable is required");
  }
  if (!RECEIVE_ADDRESS) {
    throw new Error("RECEIVE_ADDRESS environment variable is required");
  }

  // Validate and get arguments
  const args = validateArgs();

  // Initialize client
  const inscription = new Inscription(API_KEY, args.network);

  // Create order
  const runesEtchOrder = {
    files: [standardFile],
    turbo: true,
    rune: args.runeName,
    supply: SUPPLY, // 1 billion above
    symbol: args.runeSymbol,
    divisibility: 6,
    premine: SUPPLY,
    fee: 510,
    receiveAddress: RECEIVE_ADDRESS,
  };

  const response = await inscription.createRunesEtchOrder(runesEtchOrder);

  if (response && typeof response === "object" && "id" in response) {
    const orderStatus = await inscription.getOrder(response.id);
    return {
      success: true,
      message: "Rune etched successfully",
      data: `Order ID: ${response.id}, Status: ${orderStatus.status}`,
    };
  }

  throw new Error("Failed to create rune order");
}

// Execute with LLM response handling
main()
  .then(sendToLLM)
  .catch((error) => {
    sendToLLM(createErrorResponse(error));
    process.exit(1);
  });
