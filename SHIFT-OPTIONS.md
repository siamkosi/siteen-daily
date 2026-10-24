# Day/night report options

Removed the printed note สีอ่อน = ยังไม่บันทึกรายชั่วโมง. The weather color legend and recorded hourly clock remain unchanged.

Added two independent checkboxes in the editor: กลางวัน and กลางคืน, with separate editable day_period and night_period string metadata. Selecting both stores shift=both; selecting either stores day/night; neither stores an empty shift. Existing work_period is read compatibly for its previous selected shift. On toggling, both resolved periods are stored so changing selections cannot transfer the old day period into the night field. Defaults: 08:00–17:00 and 18:00–21:00. Existing Hampton daytime 8.00-17.00 remains selected; the night range is visible but unchecked. Printed boxes are read-only; choose shifts in the report editor.

Build/lint and two browser tests passed, plus a final targeted workflow rerun verifying that day/night transitions preserve custom ranges. Model checks cover legacy periods and day/night/both/none. No migration required: existing report_details.meta validation supports these fields.

Final Hampton PDF has 2 A4 pages with both shift rows and exactly one selected day checkbox per page. Removed note absent. RSV Asset, full project name, 39 people / 312 man-hours, all staffing/tool rows, date, reporter title, submitted status, six original photos and all three logos preserved. Image digests match the previous PDF; margins and both rendered pages visually checked. Long-report and seven-photo pagination also verified. No deployment.
