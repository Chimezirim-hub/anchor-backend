// lib/email.js — sends transactional email via Resend's HTTP API.
// Uses Node's built-in fetch, so no extra dependency is needed.
//
// Until a custom domain is verified in your Resend dashboard, RESEND_FROM
// stays on the shared onboarding@resend.dev address, which can only deliver
// to the email you signed up to Resend with. That's fine for testing the
// whole flow yourself. Once you verify your own domain, set RESEND_FROM to
// an address on it (e.g. orders@yourshop.com) and real customers start
// receiving these for real.

async function sendEmail({ to, subject, html }) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.log(`[email skipped — no RESEND_API_KEY set] Would have sent "${subject}" to ${to}`);
    return { skipped: true };
  }
  const from = process.env.RESEND_FROM || 'Anchor <onboarding@resend.dev>';
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({ from, to, subject, html })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.error('Resend send failed:', res.status, data);
      return { error: data };
    }
    return { id: data.id };
  } catch (err) {
    // Email failures should never break the request that triggered them —
    // an order or signup should still succeed even if the email didn't send.
    console.error('Resend send threw:', err.message);
    return { error: err.message };
  }
}

const naira = (n) => '₦' + Math.round(n).toLocaleString('en-NG');

function welcomeEmail(user) {
  return sendEmail({
    to: user.email,
    subject: 'Welcome to Anchor',
    html: `
      <div style="font-family:Arial,sans-serif;max-width:480px;margin:auto">
        <h2>Welcome, ${user.name.split(' ')[0]}.</h2>
        <p>Your Anchor account is ready. Sign in any time to pick up where you left off — your cart, saved items and orders all follow your account.</p>
        <p style="color:#888;font-size:13px">If you didn't create this account, you can ignore this email.</p>
      </div>`
  });
}

function orderConfirmationEmail(user, order) {
  const rows = order.items.map(i => `
    <tr>
      <td style="padding:6px 0">${i.name} × ${i.qty}</td>
      <td style="padding:6px 0;text-align:right">${naira(i.price * i.qty)}</td>
    </tr>`).join('');
  return sendEmail({
    to: user.email,
    subject: `Order confirmed — ${order.id}`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:480px;margin:auto">
        <h2>Thanks, ${user.name.split(' ')[0]} — your order is confirmed.</h2>
        <p>Order <strong>${order.id}</strong>, placed just now.</p>
        <table style="width:100%;border-collapse:collapse;margin:16px 0">${rows}</table>
        <p style="font-size:18px"><strong>Total: ${naira(order.total)}</strong></p>
        <p>Delivering to ${order.ship.addr}, ${order.ship.city}, ${order.ship.state}.</p>
        <p style="color:#888;font-size:13px">Track this order any time from your Anchor account.</p>
      </div>`
  });
}

module.exports = { sendEmail, welcomeEmail, orderConfirmationEmail };
