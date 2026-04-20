// Stage 11 Public Smart File Page Lambda Purpose
import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { textResponse } from "../shared/http";

const apiUrl = process.env.STUDIO_OS_API_URL;

if (!apiUrl) {
  throw new Error("Missing required environment variable: STUDIO_OS_API_URL");
}

const escapeHtml = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

export const handler = async (event: APIGatewayProxyEventV2) => {
  const token = event.pathParameters?.token;
  if (!token) {
    return textResponse(400, "Smart File token is required.");
  }

  const encodedToken = encodeURIComponent(token);
  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Kevin Smart File</title>
    <script src="https://js.stripe.com/v3/"></script>
    <style>
      body { margin: 0; font-family: Georgia, serif; background: linear-gradient(180deg, #f4efe5 0%, #efe5d5 100%); color: #1c1917; }
      .shell { max-width: 920px; margin: 0 auto; padding: 24px; }
      .card { background: rgba(255,255,255,0.92); border: 1px solid #d6d3d1; border-radius: 28px; padding: 24px; box-shadow: 0 20px 70px rgba(64,43,15,0.08); }
      .eyebrow { font: 600 11px/1.2 sans-serif; letter-spacing: .28em; text-transform: uppercase; color: #78716c; }
      h1 { font-size: clamp(2rem, 6vw, 4rem); line-height: .96; margin: 12px 0 8px; }
      h2 { font-size: 1.35rem; margin: 0 0 8px; }
      p, li, label, button, input, select { font-family: system-ui, sans-serif; }
      .grid { display: grid; gap: 16px; }
      .block { border: 1px solid #e7e5e4; border-radius: 20px; padding: 16px; background: #fafaf9; }
      .muted { color: #57534e; font-size: 14px; line-height: 1.7; }
      .status { margin-top: 12px; min-height: 24px; font: 500 14px/1.5 system-ui, sans-serif; color: #57534e; }
      .controls { display: grid; gap: 12px; margin-top: 16px; }
      .row { display: grid; gap: 12px; }
      @media (min-width: 720px) { .row { grid-template-columns: 1fr 180px; } }
      input, select, button { border-radius: 16px; border: 1px solid #d6d3d1; padding: 14px 16px; font-size: 14px; }
      button { background: #1c1917; color: #fafaf9; border-color: #1c1917; cursor: pointer; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; }
      button.secondary { background: #fafaf9; color: #1c1917; }
      #payment-element { margin-top: 16px; padding: 14px; border: 1px solid #e7e5e4; border-radius: 18px; background: white; }
      .pill { display: inline-block; border-radius: 999px; background: #eee7da; padding: 8px 12px; font: 600 12px/1.2 system-ui, sans-serif; color: #6b5c45; }
    </style>
  </head>
  <body>
    <main class="shell">
      <section class="card">
        <div class="eyebrow">Kevin Smart File</div>
        <h1 id="title">Loading...</h1>
        <p class="muted">Review the file, then complete the payment block below when applicable.</p>
        <div id="summary" class="pill">Preparing your secure payment form…</div>
      </section>
      <section class="card" style="margin-top:16px;">
        <div id="blocks" class="grid"></div>
      </section>
      <section class="card" style="margin-top:16px;">
        <div class="eyebrow">Payment</div>
        <h2>Stripe Payment Element</h2>
        <p id="payment-help" class="muted">Loading provider configuration…</p>
        <div class="controls">
          <div class="row">
            <select id="invoice-select"></select>
            <input id="amount-input" type="number" min="1" step="1" placeholder="Amount in cents" />
          </div>
          <button id="load-payment" type="button">Load payment form</button>
        </div>
        <div id="payment-element" hidden></div>
        <button id="confirm-payment" type="button" hidden style="margin-top:16px;">Pay now</button>
        <div id="status" class="status"></div>
      </section>
    </main>
    <script>
      const apiBase = ${JSON.stringify(apiUrl)};
      const token = ${JSON.stringify(encodedToken)};
      const state = { stripe: null, elements: null, checkout: null, invoices: [] };

      const blocksEl = document.getElementById("blocks");
      const titleEl = document.getElementById("title");
      const summaryEl = document.getElementById("summary");
      const paymentHelpEl = document.getElementById("payment-help");
      const invoiceSelectEl = document.getElementById("invoice-select");
      const amountInputEl = document.getElementById("amount-input");
      const paymentElementEl = document.getElementById("payment-element");
      const confirmPaymentEl = document.getElementById("confirm-payment");
      const statusEl = document.getElementById("status");
      const loadPaymentEl = document.getElementById("load-payment");

      const renderBlocks = (blocks) => {
        blocksEl.innerHTML = "";
        for (const block of blocks) {
          const article = document.createElement("article");
          article.className = "block";
          const title = document.createElement("h2");
          title.textContent = block.title || block.type.replaceAll("_", " ");
          const body = document.createElement("p");
          body.className = "muted";
          body.textContent = block.renderedContent || block.content || "No preview available.";
          article.appendChild(title);
          article.appendChild(body);
          blocksEl.appendChild(article);
        }
      };

      const setStatus = (message, isError = false) => {
        statusEl.textContent = message || "";
        statusEl.style.color = isError ? "#b91c1c" : "#57534e";
      };

      const loadSmartFile = async () => {
        const response = await fetch(apiBase + "/sign/" + token);
        const payload = await response.json();
        if (!response.ok) {
          throw new Error(payload.error || "Unable to load the Smart File.");
        }

        titleEl.textContent = payload.smartFile.title;
        summaryEl.textContent = payload.smartFile.status + (payload.paymentProvider?.available ? " • Stripe ready" : " • Manual payment only");
        paymentHelpEl.textContent = payload.paymentProvider?.available
          ? "Pick an invoice and load the Payment Element. Payment status is finalized by Stripe webhook."
          : (payload.paymentProvider?.reason || "Stripe is not configured yet.");
        renderBlocks(payload.resolvedBlocks || []);
        state.invoices = Array.isArray(payload.payableInvoices) ? payload.payableInvoices : [];
        invoiceSelectEl.innerHTML = "";
        for (const invoice of state.invoices) {
          const option = document.createElement("option");
          option.value = invoice.id;
          option.textContent = invoice.id.slice(0, 8) + " • $" + (invoice.balanceCents / 100).toFixed(2) + " due";
          option.dataset.balance = String(invoice.balanceCents);
          invoiceSelectEl.appendChild(option);
        }

        if (state.invoices[0]) {
          amountInputEl.value = String(state.invoices[0].balanceCents);
        }

        loadPaymentEl.disabled = !payload.paymentProvider?.available || state.invoices.length === 0;
        if (state.invoices.length === 0) {
          paymentHelpEl.textContent = "No payable invoice is attached to this Smart File.";
        }
      };

      invoiceSelectEl.addEventListener("change", () => {
        const selected = invoiceSelectEl.options[invoiceSelectEl.selectedIndex];
        amountInputEl.value = selected?.dataset.balance || "";
      });

      loadPaymentEl.addEventListener("click", async () => {
        try {
          setStatus("Loading payment form...");
          const response = await fetch(apiBase + "/sign/" + token + "/payment-intent", {
            method: "POST",
            headers: {
              "content-type": "application/json",
              "Idempotency-Key": (crypto.randomUUID ? crypto.randomUUID() : String(Date.now())),
            },
            body: JSON.stringify({
              invoiceId: invoiceSelectEl.value,
              amountCents: Number(amountInputEl.value || 0),
            }),
          });
          const payload = await response.json();
          if (!response.ok) {
            throw new Error(payload.error || "Unable to initialize payment.");
          }

          state.checkout = payload.checkout;
          state.stripe = window.Stripe(payload.checkout.publishableKey);
          state.elements = state.stripe.elements({ clientSecret: payload.checkout.clientSecret });
          paymentElementEl.hidden = false;
          paymentElementEl.innerHTML = "";
          const paymentElement = state.elements.create("payment");
          paymentElement.mount("#payment-element");
          confirmPaymentEl.hidden = false;
          setStatus("Payment form ready.");
        } catch (error) {
          setStatus(error.message || "Unable to initialize payment.", true);
        }
      });

      confirmPaymentEl.addEventListener("click", async () => {
        if (!state.stripe || !state.elements) {
          setStatus("Load the payment form first.", true);
          return;
        }

        confirmPaymentEl.disabled = true;
        setStatus("Confirming payment...");
        try {
          const result = await state.stripe.confirmPayment({
            elements: state.elements,
            confirmParams: {
              return_url: window.location.href,
            },
            redirect: "if_required",
          });
          if (result.error) {
            throw result.error;
          }

          setStatus("Payment submitted. Stripe webhook will update the invoice shortly.");
          await loadSmartFile();
        } catch (error) {
          setStatus(error.message || "Payment failed.", true);
        } finally {
          confirmPaymentEl.disabled = false;
        }
      });

      loadSmartFile().catch((error) => {
        titleEl.textContent = "Unable to load";
        summaryEl.textContent = "";
        paymentHelpEl.textContent = error.message || "Unable to load the Smart File.";
        setStatus(error.message || "Unable to load the Smart File.", true);
      });
    </script>
  </body>
</html>`;

  return textResponse(200, html, "text/html; charset=utf-8");
};
