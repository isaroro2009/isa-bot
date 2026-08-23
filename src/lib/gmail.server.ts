/** Construcción del mensaje RFC-2822 codificado en base64url para la Gmail API. */

function b64url(input: string) {
  return Buffer.from(input, "utf8").toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function encodeHeader(value: string) {
  // eslint-disable-next-line no-control-regex
  return /[^\x00-\x7F]/.test(value)
    ? `=?UTF-8?B?${Buffer.from(value, "utf8").toString("base64")}=?=`
    : value;
}

function chunk(base64: string) {
  return (base64.match(/.{1,76}/g) ?? []).join("\r\n");
}

export function buildRawMessage(opts: {
  to: string;
  subject: string;
  body: string;
  attachmentBase64?: string;
  attachmentName?: string;
}) {
  const boundary = `isabot_${Date.now().toString(36)}`;
  const headers = [
    `To: ${opts.to}`,
    `Subject: ${encodeHeader(opts.subject)}`,
    "MIME-Version: 1.0",
  ];

  if (!opts.attachmentBase64) {
    const msg = [...headers, 'Content-Type: text/plain; charset="UTF-8"', "", opts.body].join("\r\n");
    return b64url(msg);
  }

  const msg = [
    ...headers,
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    "",
    opts.body,
    "",
    `--${boundary}`,
    `Content-Type: application/pdf; name="${opts.attachmentName ?? "documento.pdf"}"`,
    "Content-Transfer-Encoding: base64",
    `Content-Disposition: attachment; filename="${opts.attachmentName ?? "documento.pdf"}"`,
    "",
    chunk(opts.attachmentBase64),
    "",
    `--${boundary}--`,
  ].join("\r\n");

  return b64url(msg);
}
