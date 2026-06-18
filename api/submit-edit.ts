import * as Diff from 'diff';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { action, datum, updatedData, originalData, captchaToken } = req.body;

  const resendApiKey = process.env.RESEND_API_KEY;
  const toEmail = process.env.TO_EMAIL;
  
  if (!resendApiKey || !toEmail) {
    console.error('Missing RESEND_API_KEY or TO_EMAIL environment variables.');
    return res.status(500).json({ error: 'Server configuration error' });
  }

  // Input Validation
  if (typeof action !== 'string' || !['add', 'edit', 'delete'].includes(action)) {
    return res.status(400).json({ error: 'Invalid or missing action' });
  }
  if (!datum || typeof datum !== 'object') {
    return res.status(400).json({ error: 'Invalid or missing datum' });
  }
  if (typeof captchaToken !== 'string') {
    return res.status(400).json({ error: 'Missing CAPTCHA token' });
  }

  // Verify Google reCAPTCHA
  const recaptchaSecret = process.env.RECAPTCHA_SECRET_KEY || '6LeIxAcTAAAAAGG-vFI1TnFTxWfn0tBt8yU8Vxdz';
  try {
    const verifyResponse = await fetch('https://www.google.com/recaptcha/api/siteverify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: `secret=${recaptchaSecret}&response=${captchaToken}`
    });
    
    const verificationResult = await verifyResponse.json();
    if (!verificationResult.success) {
      return res.status(400).json({ error: 'CAPTCHA verification failed. Please try again.' });
    }
  } catch (error: any) {
    console.error('reCAPTCHA verification exception:', error);
    return res.status(500).json({ error: 'Internal server error during verification' });
  }


  const actionText = action.toUpperCase();
  const rawPersonName = datum?.data ? `${datum.data['first name'] || ''} ${datum.data['last name'] || ''}`.trim() : 'Unknown';
  const personName = escapeHtml(rawPersonName);

  // Generate git diff style patch
  let patchHtml = '';
  let updatedJsonStr = '';
  if (updatedData) {
    updatedJsonStr = JSON.stringify(updatedData, null, 2);
  }
  
  if (updatedData && originalData) {
    let originalDataToDiff = originalData;
    if (action === 'add' && Array.isArray(originalData)) {
      const targetId = datum?.data?.id || datum?.id;
      // Remove the newly added person from originalData to show their full insertion in the diff
      originalDataToDiff = originalData.filter((d: any) => d.id !== targetId);
      originalDataToDiff = JSON.parse(JSON.stringify(originalDataToDiff));

      // Remove references to the new person from their relatives
      originalDataToDiff.forEach((d: any) => {
        if (d.rels) {
          if (d.rels.father === targetId) delete d.rels.father;
          if (d.rels.mother === targetId) delete d.rels.mother;
          if (Array.isArray(d.rels.children)) {
            d.rels.children = d.rels.children.filter((id: string) => id !== targetId);
          }
          if (Array.isArray(d.rels.spouses)) {
            d.rels.spouses = d.rels.spouses.filter((id: string) => id !== targetId);
          }
        }
      });
    }

    const originalJson = JSON.stringify(originalDataToDiff, null, 2);
    const patchString = Diff.createPatch('src/data.ts', originalJson, updatedJsonStr, 'Original', 'Updated');
    // Colorize the diff for email
    patchHtml = escapeHtml(patchString)
      .split('\n')
      .map(line => {
        if (line.startsWith('+') && !line.startsWith('+++')) return `<span style="color: #a3be8c;">${line}</span>`;
        if (line.startsWith('-') && !line.startsWith('---')) return `<span style="color: #bf616a;">${line}</span>`;
        if (line.startsWith('@')) return `<span style="color: #88c0d0;">${line}</span>`;
        if (line.startsWith('+++') || line.startsWith('---') || line.startsWith('Index:') || line.startsWith('===')) return `<span style="color: #ebcb8b; font-weight: bold;">${line}</span>`;
        return line;
      })
      .join('\n');
  }

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

            ${patchHtml ? `
              <h3>Data Changes (Git Diff):</h3>
              <p>You can see the exact changes below:</p>
              <div class="data-block">${patchHtml}</div>
            ` : ''}

            ${updatedJsonStr ? `
              <h3>Full Updated Data (JSON):</h3>
              <p>Here is the complete state of the family tree after this request:</p>
              <div class="data-block">${escapeHtml(updatedJsonStr)}</div>
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
