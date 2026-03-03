import { defineProvider, http } from 'statocysts'

/**
 * DingTalk (钉钉) webhook robot notification provider
 *
 * URL format: dingtalk://robot/<access_token>?secret=<secret>
 * - access_token: Required. The webhook robot access token
 * - secret: Optional. HMAC-SHA256 signing secret for authentication (鉴权)
 *
 * Example:
 *   dingtalk://robot/your_access_token?secret=your_secret
 *   dingtalk://robot/your_access_token
 */
export const dingtalk = defineProvider('dingtalk:', {
  transport: http,
  defaultOptions: {},
  async prepare(ctx) {
    const { url, message } = ctx

    const accessToken = url.pathname.split('/').filter(Boolean)[0]
    if (!accessToken) {
      throw new Error('DingTalk access_token is required')
    }

    const secret = url.searchParams.get('secret') || ''

    // Build the DingTalk webhook URL
    const requestUrl = new URL('https://oapi.dingtalk.com/robot/send')
    requestUrl.searchParams.set('access_token', accessToken)

    // If secret is provided, compute HMAC-SHA256 signature for authentication
    if (secret) {
      const timestamp = Date.now().toString()
      const stringToSign = `${timestamp}\n${secret}`

      const encoder = new TextEncoder()
      const key = await crypto.subtle.importKey(
        'raw',
        encoder.encode(secret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign'],
      )
      const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(stringToSign))
      const sign = btoa(String.fromCharCode(...new Uint8Array(signature)))

      requestUrl.searchParams.set('timestamp', timestamp)
      requestUrl.searchParams.set('sign', sign)
    }

    // Build message body as markdown
    const text = message.body
      ? `${message.title}\n\n${message.body}`
      : message.title

    const body = {
      msgtype: 'markdown',
      markdown: {
        title: message.title,
        text,
      },
    }

    const headers = new Headers([['Content-Type', 'application/json']])

    return {
      request: new Request(requestUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      }),
    }
  },
})
