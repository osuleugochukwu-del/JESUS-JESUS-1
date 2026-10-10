/* Trade Avata public live configuration.
 * These values are browser-visible and MUST NOT contain secrets.
 * Deploy the included secure gateway/backend first, then set its public HTTPS address below.
 * The same backend provides cTrader OAuth/live market functions plus secure TA ID/Owner bootstrap.
 */
const TRADE_AVATA_BACKEND_HTTP=''; // e.g. https://your-secure-trade-avata-gateway.example

window.TRADE_AVATA_BACKEND_CONFIG={
  apiHttp:TRADE_AVATA_BACKEND_HTTP
};

window.TRADE_AVATA_CTRADER_CONFIG={
  gatewayHttp:TRADE_AVATA_BACKEND_HTTP
};
