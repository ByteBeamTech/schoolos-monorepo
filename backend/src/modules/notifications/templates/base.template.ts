export function baseTemplate(content: string): string {
  return `
<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8" />
    <title>SchoolOS Notification</title>
  </head>

  <body
    style="
      margin: 0;
      padding: 0;
      background-color: #f4f6f8;
      font-family: Arial, sans-serif;
    "
  >
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td align="center" style="padding: 40px 0">
          <table
            width="600"
            cellpadding="0"
            cellspacing="0"
            style="
              background: #ffffff;
              border-radius: 8px;
              overflow: hidden;
              box-shadow: 0 2px 8px rgba(0,0,0,0.08);
            "
          >
            <tr>
              <td
                style="
                  background: #1e293b;
                  color: white;
                  padding: 24px;
                  text-align: center;
                  font-size: 24px;
                  font-weight: bold;
                "
              >
                SchoolOS
              </td>
            </tr>

            <tr>
              <td style="padding: 32px">
                ${content}
              </td>
            </tr>

            <tr>
              <td
                style="
                  background: #f8fafc;
                  padding: 20px;
                  text-align: center;
                  color: #64748b;
                  font-size: 12px;
                "
              >
                © ${new Date().getFullYear()} SchoolOS
                <br />
                This is an automated notification.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
`;
}
