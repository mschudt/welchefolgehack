import pandas as pd
import matplotlib.pyplot as plt
import re

with open("screenlog.0", "r") as f:
    log_data = f.readlines()

timestamps = []

datetime_pattern = re.compile(r'\[\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\]')

for line in log_data:
    line = line.strip()
    datetime_match = datetime_pattern.search(line)
    if datetime_match and "incoming request" in line:
        try:
            timestamp_str = datetime_match.group()[1:-1]
            timestamp = pd.to_datetime(timestamp_str)
            timestamps.append(timestamp)
        except Exception as ex:
            print(f"Error processing line: {line}")
            print(f"Exception: {ex}")

df = pd.DataFrame({'timestamp': timestamps})

df['date'] = df['timestamp'].dt.date
request_counts_per_day = df.groupby('date').size()

for count in request_counts_per_day:
    print(count)
    
plt.figure(figsize=(10, 6))
request_counts_per_day.plot(kind='bar')
plt.xlabel('Date')
plt.ylabel('Number of Incoming Requests')
plt.title('Incoming Requests per Day')
plt.xticks(rotation=45)
plt.grid(True, which='both', linestyle='--', linewidth=0.5)
plt.tight_layout()
plt.show()
