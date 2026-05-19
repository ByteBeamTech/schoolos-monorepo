import { baseTemplate } from './base.template';

interface AnnouncementTemplateData {
  title: string;
  body: string;
}

export function announcementTemplate(
  data: AnnouncementTemplateData,
): string {
  return baseTemplate(`
<h2
  style="
    margin-top: 0;
    color: #0f172a;
  "
>
  ${data.title}
</h2>

<p
  style="
    color: #334155;
    line-height: 1.7;
    font-size: 15px;
  "
>
  ${data.body}
</p>
`);
}

