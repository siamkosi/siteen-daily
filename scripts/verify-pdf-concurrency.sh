#!/bin/sh
set -eu
mkdir -p /tmp/pdf-concurrent
start=$(date +%s)
node --experimental-strip-types scripts/pdf-smoke.mjs /tmp/pdf-concurrent/engineer-a > /tmp/pdf-concurrent/a.log 2>&1 &
first=$!
node --experimental-strip-types scripts/pdf-smoke.mjs /tmp/pdf-concurrent/engineer-b > /tmp/pdf-concurrent/b.log 2>&1 &
second=$!
set +e
wait "$first"
first_code=$?
wait "$second"
second_code=$?
set -e
cat /tmp/pdf-concurrent/a.log /tmp/pdf-concurrent/b.log
end=$(date +%s)
peak=$(cat /sys/fs/cgroup/memory.peak)
pids=$(cat /sys/fs/cgroup/pids.peak)
denials=$(awk '$1=="max" {print $2}' /sys/fs/cgroup/pids.events)
printf '{"parallel_jobs":2,"pdf_files":4,"elapsed_seconds":%s,"memory_peak_bytes":%s,"pids_peak":%s,"pids_limit_denials":%s,"job_exit_codes":[%s,%s]}\n' "$((end-start))" "$peak" "$pids" "$denials" "$first_code" "$second_code" > /tmp/pdf-concurrent/metrics.json
cat /tmp/pdf-concurrent/metrics.json
test "$first_code" -eq 0
test "$second_code" -eq 0
for engineer in engineer-a engineer-b; do
  for kind in report request; do
    pdfinfo "/tmp/pdf-concurrent/$engineer/$kind.pdf" | grep -Eq '^Pages:[[:space:]]+2$'
  done
done
echo 'PASS: two concurrent Linux PDF jobs; four two-page synthetic PDFs'
