/**
 * Custom HTML templates for the OAuth callback page.
 * Passed to mcp-oauth-provider's createCallbackServer().
 *
 * Success page: plain HTML string (no placeholders).
 * Error page: must preserve {{error}}, {{#if error_description}}...{{/if}},
 *             and {{#if error_uri}}...{{/if}} placeholders for renderTemplate().
 */

export const SUCCESS_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Phanourios \u2014 Connected</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      background: #f7f6f3;
      color: #37352f;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 1rem;
    }

    .container {
      background: #ffffff;
      max-width: 420px;
      width: 100%;
      padding: 3rem 2.5rem;
      border-radius: 8px;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04), 0 4px 12px rgba(0, 0, 0, 0.06);
      text-align: center;
    }

    .checkmark-wrapper {
      width: 72px;
      height: 72px;
      margin: 0 auto 1.5rem;
    }

    .checkmark-circle {
      fill: none;
      stroke: #37b679;
      stroke-width: 2;
      stroke-dasharray: 188.5;
      stroke-dashoffset: 188.5;
      animation: draw-circle 0.7s cubic-bezier(0.65, 0, 0.45, 1) forwards;
    }

    .checkmark-check {
      fill: none;
      stroke: #37b679;
      stroke-width: 3;
      stroke-linecap: round;
      stroke-linejoin: round;
      stroke-dasharray: 44;
      stroke-dashoffset: 44;
      animation: draw-check 0.4s cubic-bezier(0.65, 0, 0.45, 1) 0.6s forwards;
    }

    .checkmark-wrapper svg {
      animation: pop 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) 1.0s both;
    }

    @keyframes draw-circle {
      to { stroke-dashoffset: 0; }
    }

    @keyframes draw-check {
      to { stroke-dashoffset: 0; }
    }

    @keyframes pop {
      0%   { transform: scale(1); }
      50%  { transform: scale(1.12); }
      100% { transform: scale(1); }
    }

    h1 {
      font-size: 1.375rem;
      font-weight: 600;
      margin-bottom: 0.75rem;
      color: #37352f;
    }

    p {
      font-size: 0.9375rem;
      line-height: 1.6;
      color: #787774;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="checkmark-wrapper">
      <svg viewBox="0 0 72 72" xmlns="http://www.w3.org/2000/svg">
        <circle class="checkmark-circle" cx="36" cy="36" r="30" />
        <polyline class="checkmark-check" points="22,38 32,46 50,26" />
      </svg>
    </div>
    <h1>Connected</h1>
    <p>Phanourios is now connected to your Notion workspace. You can close this tab and return to your terminal.</p>
  </div>
</body>
</html>`;

export const ERROR_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Phanourios \u2014 Connection Failed</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      background: #f7f6f3;
      color: #37352f;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 1rem;
    }

    .container {
      background: #ffffff;
      max-width: 420px;
      width: 100%;
      padding: 3rem 2.5rem;
      border-radius: 8px;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04), 0 4px 12px rgba(0, 0, 0, 0.06);
      text-align: center;
    }

    .error-icon {
      width: 72px;
      height: 72px;
      margin: 0 auto 1.5rem;
    }

    .error-circle {
      fill: none;
      stroke: #e03e3e;
      stroke-width: 2;
    }

    .error-x {
      fill: none;
      stroke: #e03e3e;
      stroke-width: 3;
      stroke-linecap: round;
    }

    h1 {
      font-size: 1.375rem;
      font-weight: 600;
      margin-bottom: 0.75rem;
      color: #37352f;
    }

    .error-code {
      display: inline-block;
      background: #fbe4e4;
      color: #e03e3e;
      font-family: 'SFMono-Regular', Menlo, Consolas, monospace;
      font-size: 0.8125rem;
      padding: 0.35rem 0.75rem;
      border-radius: 4px;
      margin-bottom: 1rem;
    }

    p {
      font-size: 0.9375rem;
      line-height: 1.6;
      color: #787774;
    }

    .error-details {
      text-align: left;
      background: #f7f6f3;
      padding: 1rem;
      border-radius: 6px;
      margin: 1rem 0;
      border-left: 3px solid #e03e3e;
      font-size: 0.875rem;
      color: #37352f;
    }

    .retry-link {
      display: inline-block;
      margin-top: 1.25rem;
      color: #37352f;
      font-size: 0.9375rem;
      text-decoration: underline;
      text-underline-offset: 2px;
    }

    .retry-link:hover {
      color: #787774;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="error-icon">
      <svg viewBox="0 0 72 72" xmlns="http://www.w3.org/2000/svg">
        <circle class="error-circle" cx="36" cy="36" r="30" />
        <line class="error-x" x1="26" y1="26" x2="46" y2="46" />
        <line class="error-x" x1="46" y1="26" x2="26" y2="46" />
      </svg>
    </div>
    <h1>Connection Failed</h1>
    <div class="error-code">{{error}}</div>
    <p>Phanourios could not connect to your Notion workspace.</p>

    {{#if error_description}}
    <div class="error-details">{{error_description}}</div>
    {{/if}}

    {{#if error_uri}}
    <p><a href="{{error_uri}}" target="_blank" class="retry-link">More information</a></p>
    {{/if}}

    <a href="javascript:history.back()" class="retry-link">Try again</a>
  </div>
</body>
</html>`;
