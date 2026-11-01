import network
import machine
import dht
import time
import urequests

# ==========================================
# Practical 2.1 : Temperature Logger
# Raspberry Pi Pico W + DHT22 + ThingSpeak
# ==========================================

# -------- Wi-Fi Setup --------
WIFI_SSID = "Wokwi-GUEST"
WIFI_PASSWORD = ""

# -------- ThingSpeak Setup --------
THINGSPEAK_API_KEY = "H79CELTOB6HOLO7U"
THINGSPEAK_URL = "https://api.thingspeak.com/update"

# -------- Connect Wi-Fi --------
wifi = network.WLAN(network.STA_IF)
wifi.active(True)

if not wifi.isconnected():
    print("Connecting to Wi-Fi...")
    wifi.connect(WIFI_SSID, WIFI_PASSWORD)

    while not wifi.isconnected():
        print(".", end="")
        time.sleep(1)

print("\nWi-Fi Connected!")
print("IP Address:", wifi.ifconfig()[0])


# -------- Sensor Setup --------
sensor = dht.DHT22(machine.Pin(0))      # DATA -> GP0
led = machine.Pin(1, machine.Pin.OUT)   # Optional LED


# -------- CSV File --------
csv_file = "dht22_log.csv"

with open(csv_file, "w") as f:
    f.write("Reading,Time_s,Temperature_C,Humidity_%\n")


# -------- Variables --------
temps = []
hums = []

TOTAL_READINGS = 30
INTERVAL = 20      # seconds (ThingSpeak needs enough time between updates)

print("===================================")
print(" DHT22 Temperature Logger Started ")
print("===================================")
print("Collecting 30 readings...\n")

start_time = time.time()


# -------- Main Loop --------
for i in range(TOTAL_READINGS):

    sensor.measure()

    temp = sensor.temperature()
    hum = sensor.humidity()

    elapsed = time.time() - start_time


    # Store readings in lists
    temps.append(temp)
    hums.append(hum)


    # LED ON if temperature > 30°C
    if temp > 30:
        led.value(1)
    else:
        led.value(0)


    # Display on Serial Monitor
    print("--------------------------------")
    print("Reading :", i + 1)
    print("Time    :", elapsed, "s")
    print("Temp    :", temp, "°C")
    print("Humidity:", hum, "%")


    # Save to CSV
    with open(csv_file, "a") as f:
        f.write("{},{},{},{}\n".format(
            i + 1,
            elapsed,
            temp,
            hum
        ))


    # -------- Upload to ThingSpeak --------
    try:
        url = (
            THINGSPEAK_URL
            + "?api_key=" + THINGSPEAK_API_KEY
            + "&field1=" + str(temp)
            + "&field2=" + str(hum)
        )

        print("Uploading to ThingSpeak...")

        response = urequests.get(url)

        print("ThingSpeak Response:", response.text)

        response.close()

    except Exception as e:
        print("ThingSpeak Upload Error:", e)


    # Wait before next reading
    time.sleep(INTERVAL)


# -------- Calculations --------

min_temp = min(temps)
max_temp = max(temps)
avg_temp = sum(temps) / len(temps)

min_hum = min(hums)
max_hum = max(hums)
avg_hum = sum(hums) / len(hums)


# -------- Results --------

print("\n===================================")
print("     30 READINGS COMPLETED")
print("===================================")


print("\nTemperature Statistics")
print("Minimum :", round(min_temp, 1), "°C")
print("Maximum :", round(max_temp, 1), "°C")
print("Average :", round(avg_temp, 2), "°C")


print("\nHumidity Statistics")
print("Minimum :", round(min_hum, 1), "%")
print("Maximum :", round(max_hum, 1), "%")
print("Average :", round(avg_hum, 2), "%")


print("\nCSV file saved as:", csv_file)
print("Program Finished.")