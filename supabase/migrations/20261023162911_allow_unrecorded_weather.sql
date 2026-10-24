begin;
alter table public.daily_reports drop constraint daily_reports_weather_check;
alter table public.daily_reports add constraint daily_reports_weather_check
check (weather in ('แดดออก','มีเมฆมาก','ฝนตก','ฝนตกหนัก / หยุดงาน','ยังไม่บันทึก'));
commit;
