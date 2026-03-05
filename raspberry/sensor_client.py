#!/usr/bin/env python3
"""
레이저 센서 이벤트를 서버(/api/congestion/event)로 전송하는 라즈베리파이 클라이언트.

실행 예시:
python3 sensor_client.py \
  --server-url http://192.168.0.10:3000 \
  --sensor-token your-token \
  --entry-pin 17 \
  --exit-pin 27

장비 없이 테스트:
python3 sensor_client.py --server-url http://localhost:3000 --mock
"""

from __future__ import annotations

import argparse
import logging
import random
import signal
import sys
import time
from dataclasses import dataclass

import requests

try:
    import RPi.GPIO as GPIO  # type: ignore

    GPIO_AVAILABLE = True
except Exception:
    GPIO_AVAILABLE = False


@dataclass
class SensorConfig:
    server_url: str
    sensor_token: str
    entry_pin: int
    exit_pin: int
    cooldown_sec: float
    mock_mode: bool


class SensorClient:
    def __init__(self, config: SensorConfig):
        self.config = config
        self.session = requests.Session()
        self.running = True
        self.last_fired = {"entry": 0.0, "exit": 0.0}

    def stop(self):
        self.running = False

    def send_event(self, event_type: str, sensor_id: str):
        now = time.time()
        if now - self.last_fired[event_type] < self.config.cooldown_sec:
            return

        self.last_fired[event_type] = now

        endpoint = f"{self.config.server_url.rstrip('/')}/api/congestion/event"
        payload = {
            "eventType": event_type,
            "amount": 1,
            "sensorId": sensor_id,
            "eventAt": time.strftime("%Y-%m-%dT%H:%M:%S%z"),
        }

        headers = {}
        if self.config.sensor_token:
            headers["x-sensor-token"] = self.config.sensor_token

        try:
            response = self.session.post(endpoint, json=payload, headers=headers, timeout=4)
            if response.status_code >= 400:
                logging.error("Event send failed: %s %s", response.status_code, response.text)
                return
            logging.info("Event sent: %s (%s)", event_type, sensor_id)
        except requests.RequestException as exc:
            logging.error("Event send error: %s", exc)

    def run_mock(self):
        logging.info("Mock mode started. Random events will be sent every 2-5 sec.")
        while self.running:
            time.sleep(random.uniform(2, 5))
            event_type = "entry" if random.random() > 0.4 else "exit"
            sensor_id = "mock-entry" if event_type == "entry" else "mock-exit"
            self.send_event(event_type, sensor_id)

    def run_gpio(self):
        if not GPIO_AVAILABLE:
            raise RuntimeError("RPi.GPIO is not available. Install on Raspberry Pi or use --mock.")

        GPIO.setwarnings(False)
        GPIO.setmode(GPIO.BCM)
        GPIO.setup(self.config.entry_pin, GPIO.IN, pull_up_down=GPIO.PUD_UP)
        GPIO.setup(self.config.exit_pin, GPIO.IN, pull_up_down=GPIO.PUD_UP)

        def on_entry(_channel):
            self.send_event("entry", f"gpio-{self.config.entry_pin}")

        def on_exit(_channel):
            self.send_event("exit", f"gpio-{self.config.exit_pin}")

        GPIO.add_event_detect(self.config.entry_pin, GPIO.FALLING, callback=on_entry, bouncetime=200)
        GPIO.add_event_detect(self.config.exit_pin, GPIO.FALLING, callback=on_exit, bouncetime=200)

        logging.info(
            "GPIO mode started. entry_pin=%d, exit_pin=%d",
            self.config.entry_pin,
            self.config.exit_pin,
        )

        try:
            while self.running:
                time.sleep(0.4)
        finally:
            GPIO.cleanup()


def parse_args() -> SensorConfig:
    parser = argparse.ArgumentParser(description="Raspberry Pi laser sensor client")
    parser.add_argument("--server-url", required=True, help="Dashboard server URL")
    parser.add_argument("--sensor-token", default="", help="SENSOR_AUTH_TOKEN value")
    parser.add_argument("--entry-pin", type=int, default=17, help="GPIO BCM pin for entry sensor")
    parser.add_argument("--exit-pin", type=int, default=27, help="GPIO BCM pin for exit sensor")
    parser.add_argument("--cooldown-sec", type=float, default=0.7, help="Ignore repeated trigger within this sec")
    parser.add_argument("--mock", action="store_true", help="Use mock mode without GPIO")

    args = parser.parse_args()
    return SensorConfig(
        server_url=args.server_url,
        sensor_token=args.sensor_token,
        entry_pin=args.entry_pin,
        exit_pin=args.exit_pin,
        cooldown_sec=args.cooldown_sec,
        mock_mode=args.mock,
    )


def main():
    logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
    config = parse_args()
    client = SensorClient(config)

    def on_signal(_signum, _frame):
        logging.info("Signal received. Shutting down...")
        client.stop()

    signal.signal(signal.SIGINT, on_signal)
    signal.signal(signal.SIGTERM, on_signal)

    try:
        if config.mock_mode:
            client.run_mock()
        else:
            client.run_gpio()
    except Exception as exc:
        logging.error("Fatal error: %s", exc)
        sys.exit(1)


if __name__ == "__main__":
    main()
