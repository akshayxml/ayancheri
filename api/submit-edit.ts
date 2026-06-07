export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { action, datum, updatedData } = req.body;

  const resendApiKey = process.env.RESEND_API_KEY;
  const toEmail = process.env.TO_EMAIL;
  
  if (!resendApiKey || !toEmail) {
    console.error('Missing RESEND_API_KEY or TO_EMAIL environment variables.');
    return res.status(500).json({ error: 'Server configuration error' });
  }

  const actionText = action.toUpperCase();
  const rawPersonName = datum?.data ? `${datum.data['first name'] || ''} ${datum.data['last name'] || ''}`.trim() : 'Unknown';
  const personName = escapeHtml(rawPersonName);

  // Format a nice HTML email
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eaeaea; border-radius: 10px; }
          .header { background: linear-gradient(135deg, #aa3bff 0%, #7a1bcf 100%); color: white; padding: 20px; border-radius: 8px 8px 0 0; text-align: center; }
          .header h1 { margin: 0; font-size: 20px; }
          .content { padding: 20px; }
          .badge { display: inline-block; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: bold; text-transform: uppercase; }
          .badge-edit { background-color: #fef3c7; color: #d97706; }
          .badge-add { background-color: #d1fae5; color: #059669; }
          .badge-delete { background-color: #fee2e2; color: #dc2626; }
          .detail-section { margin-top: 20px; background-color: #f9fafb; padding: 15px; border-radius: 6px; border: 1px solid #f3f4f6; }
          .field-row { display: flex; border-bottom: 1px solid #f3f4f6; padding: 8px 0; }
          .field-label { width: 120px; font-weight: 600; color: #666; }
          .field-value { flex: 1; }
          .data-block { background-color: #1e1e1e; color: #a9b7c6; padding: 15px; border-radius: 6px; font-family: monospace; font-size: 12px; overflow-x: auto; white-space: pre-wrap; margin-top: 15px; }
          .footer { margin-top: 25px; text-align: center; font-size: 12px; color: #999; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Family Tree Modification Request</h1>
          </div>
          <div class="content">
            <p>A new request has been submitted to modify the family tree.</p>
            
            <div class="field-row">
              <span class="field-label">Action:</span>
              <span class="field-value">
                <span class="badge badge-${escapeHtml(action.toLowerCase())}">${escapeHtml(actionText)}</span>
              </span>
            </div>
            
            <div class="field-row">
              <span class="field-label">Target Person:</span>
              <span class="field-value"><strong>${personName}</strong> (ID: ${escapeHtml(datum?.id || 'N/A')})</span>
            </div>

            <div class="detail-section">
              <h3>Proposed Details:</h3>
              <div class="field-row">
                <span class="field-label">First Name:</span>
                <span class="field-value">${renderField(datum?.data?.['first name'])}</span>
              </div>
              <div class="field-row">
                <span class="field-label">Last Name:</span>
                <span class="field-value">${renderField(datum?.data?.['last name'])}</span>
              </div>
              <div class="field-row">
                <span class="field-label">Gender:</span>
                <span class="field-value">${renderField(datum?.data?.gender)}</span>
              </div>
              <div class="field-row">
                <span class="field-label">Birthday:</span>
                <span class="field-value">${renderField(datum?.data?.birthday)}</span>
              </div>
              <div class="field-row">
                <span class="field-label">Avatar URL:</span>
                <span class="field-value">${renderField(datum?.data?.avatar)}</span>
              </div>
            </div>

            ${updatedData ? `
              <h3>Updated Full Data JSON Snippet:</h3>
              <p>You can copy the content below and replace it in <code>src/data.ts</code>:</p>
              <div class="data-block">export const familyData = ${escapeHtml(JSON.stringify(updatedData, null, 2))};</div>
            ` : ''}
          </div>
          <div class="footer">
            <p>This notification was automatically sent by your family tree app hosted on Vercel.</p>
          </div>
        </div>
      </body>
    </html>
  `;

  try {
    const fromEmail = process.env.FROM_EMAIL || 'onboarding@resend.dev';
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${resendApiKey}`
      },
      body: JSON.stringify({
        from: `Family Tree <${fromEmail}>`,
        to: [toEmail],
        subject: `[Pending Approval] Family Tree: ${actionText} - ${rawPersonName}`,
        html: html
      })
    });

    const result = await response.json();

    if (!response.ok) {
      console.error('Resend API Error:', result);
      return res.status(response.status).json({ error: result.message || 'Error sending email via Resend' });
    }

    return res.status(200).json({ success: true, id: result.id });
  } catch (error: any) {
    console.error('Fetch exception when contacting Resend:', error);
    return res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
}

function escapeHtml(str: any): string {
  if (str === null || str === undefined) return '';
  return String(str).replace(/[&<>"']/g, (match) => {
    switch (match) {
      case '&': return '&amp;';
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '"': return '&quot;';
      case "'": return '&#39;';
      default: return match;
    }
  });
}

function renderField(val: any): string {
  return val ? escapeHtml(val) : '<i>Empty</i>';
}
