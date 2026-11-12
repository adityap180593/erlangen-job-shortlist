# Erlangen job dashboard

Public vacancy suggestions organised by their first recommendation day. The existing three application-document categories and bilingual copy fields are retained.

## Private application tracking

Each card has Not applied (default), Applied, Rejected, Interview invitation and Not available. Summary counts follow the date/category/search selection. Applied means awaiting a response. Application status is distinct from the advert's last verified availability.

Choices stay in the visitor's browser under localStorage key erlangen-job-shortlist.statuses.v1; no status data is sent to this repository or a server. They persist across dashboard updates while the same browser/site data is retained. Export/import transfers progress manually between browsers/devices. Imports keep the most recent update per canonical vacancy key. Do not commit exported status files.

## Updating listings

index.html is cumulative, not a replacement with today's jobs only. data/jobs.json contains public card content, first recommendation dates, categories and canonical vacancy keys. Dated reports remain in reports/. The generator in the owner's local workspace preserves history and makes cover-letter field IDs unique. Keep the tracker/copy assets and storage schema stable.

No CVs, candidate profile, personalised fit notes, HR phone calling lists, application records or credentials are published here. The portal shows vacancy source/check dates and flags uncertain information. Older suggestions may no longer be open.

