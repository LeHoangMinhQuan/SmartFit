import type { UIMessage } from "ai";
import ChatProductCard from "./ChatProductCard";
import ChatCartRedirect from "./ChatCartRedirect";
import ChatCheckoutRedirect from "./ChatCheckoutRedirect";
import type {
  ChatAddToCartOutput,
  ChatPrepareCheckoutOutput,
  ChatProductCardData,
  ChatToolError,
} from "@/interfaces";

interface ChatMessageBubbleProps {
  message: UIMessage;
}

/**
 * Renders one message's `parts` array. TOOLS isn't type-parameterized
 * across the fe/be boundary (separate packages, same as every other API
 * shape in this app — see interfaces.tsx), so tool part `input`/`output`
 * are narrowed by hand via the ChatProductCardData/ChatAddToCartOutput/
 * ChatToolError interfaces rather than inferred generically.
 */
export default function ChatMessageBubble({ message }: ChatMessageBubbleProps) {
  const isUser = message.role === "user";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] space-y-2 rounded-2xl px-4 py-2.5 text-sm ${
          isUser ? "bg-black text-white" : "bg-gray-100 text-black"
        }`}
      >
        {message.parts.map((part, i) => {
          if (part.type === "text") {
            return (
              <p key={i} className="whitespace-pre-wrap">
                {part.text}
              </p>
            );
          }

          if (part.type === "tool-search_products") {
            if (part.state !== "output-available") {
              return (
                <p key={i} className="text-xs italic text-gray-500">
                  Searching the catalog…
                </p>
              );
            }
            const output = part.output as ChatProductCardData[] | ChatToolError;
            if ("error" in output) {
              return (
                <p key={i} className="text-xs text-red-600">
                  {output.error}
                </p>
              );
            }
            if (!output.length) {
              return (
                <p key={i} className="text-xs text-gray-500">
                  No matching products found.
                </p>
              );
            }
            return (
              <div key={i} className="space-y-2">
                {output.map((card) => (
                  <ChatProductCard key={card.product_id} {...card} />
                ))}
              </div>
            );
          }

          if (part.type === "tool-add_to_cart") {
            if (part.state !== "output-available") return null;
            const output = part.output as ChatAddToCartOutput | ChatToolError;
            if ("error" in output) {
              return (
                <p key={i} className="text-xs text-red-600">
                  {output.error}
                </p>
              );
            }
            return <ChatCartRedirect key={i} cartUrl={output.cart_url} />;
          }

          if (part.type === "tool-prepare_checkout") {
            if (part.state !== "output-available") {
              return (
                <p key={i} className="text-xs italic text-gray-500">
                  Preparing checkout…
                </p>
              );
            }
            const output = part.output as
              | ChatPrepareCheckoutOutput
              | ChatToolError;
            if ("error" in output) {
              return (
                <p key={i} className="text-xs text-red-600">
                  {output.error}
                </p>
              );
            }
            return (
              <ChatCheckoutRedirect
                key={i}
                checkoutUrl={output.checkout_url}
                warnings={output.warnings}
              />
            );
          }

          return null;
        })}
      </div>
    </div>
  );
}
