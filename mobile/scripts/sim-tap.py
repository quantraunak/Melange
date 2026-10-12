"""Drive the booted iOS Simulator with synthesized Quartz events.

Learned the hard way across several runs, and the reason this file exists
rather than a one-liner:

  * `osascript ... click at` does not register on the Simulator at all.
  * Events must go to `kCGSessionEventTap`, not `kCGHIDEventTap`.
  * A move event before the press is required or the first click is swallowed.
  * Taps silently do nothing when the Simulator is not frontmost, so every
    call activates it first.
  * The window's AX frame includes the title chrome above the device screen
    and a bezel either side, so device points need mapping before use.

Usage:
    python3 scripts/sim-tap.py tap <x> <y>          # device points
    python3 scripts/sim-tap.py swipe <x1> <y1> <x2> <y2> [steps]
    python3 scripts/sim-tap.py frame                # print the mapping
"""

import subprocess
import sys
import time

import Quartz

DEVICE_W, DEVICE_H = 440.0, 956.0
CHROME_TOP = 64.0
BEZEL_X = 17.0


def activate() -> None:
    subprocess.run(
        ["osascript", "-e", 'tell application "Simulator" to activate'],
        capture_output=True,
    )
    time.sleep(0.35)


def window_frame():
    script = (
        'tell application "System Events" to tell process "Simulator" '
        "to get {position, size} of window 1"
    )
    out = subprocess.check_output(["osascript", "-e", script], text=True).strip()
    nums = [float(n) for n in out.replace(",", " ").split()]
    x, y, w, h = nums[0], nums[1], nums[2], nums[3]
    return x, y, w, h


def to_screen(dx: float, dy: float):
    x, y, w, h = window_frame()
    inner_w = w - 2 * BEZEL_X
    scale = inner_w / DEVICE_W
    return x + BEZEL_X + dx * scale, y + CHROME_TOP + dy * scale


def post(event) -> None:
    Quartz.CGEventPost(Quartz.kCGSessionEventTap, event)


def move(sx: float, sy: float) -> None:
    post(Quartz.CGEventCreateMouseEvent(None, Quartz.kCGEventMouseMoved, (sx, sy), 0))
    time.sleep(0.08)


def tap(dx: float, dy: float) -> None:
    activate()
    sx, sy = to_screen(dx, dy)
    move(sx, sy)
    post(Quartz.CGEventCreateMouseEvent(None, Quartz.kCGEventLeftMouseDown, (sx, sy), 0))
    time.sleep(0.09)
    post(Quartz.CGEventCreateMouseEvent(None, Quartz.kCGEventLeftMouseUp, (sx, sy), 0))
    time.sleep(0.5)


def swipe(x1: float, y1: float, x2: float, y2: float, steps: int = 22) -> None:
    activate()
    sx1, sy1 = to_screen(x1, y1)
    sx2, sy2 = to_screen(x2, y2)
    move(sx1, sy1)
    post(Quartz.CGEventCreateMouseEvent(None, Quartz.kCGEventLeftMouseDown, (sx1, sy1), 0))
    time.sleep(0.06)
    for i in range(1, steps + 1):
        t = i / steps
        px = sx1 + (sx2 - sx1) * t
        py = sy1 + (sy2 - sy1) * t
        post(Quartz.CGEventCreateMouseEvent(None, Quartz.kCGEventLeftMouseDragged, (px, py), 0))
        time.sleep(0.012)
    post(Quartz.CGEventCreateMouseEvent(None, Quartz.kCGEventLeftMouseUp, (sx2, sy2), 0))
    time.sleep(0.6)


if __name__ == "__main__":
    cmd = sys.argv[1]
    if cmd == "tap":
        tap(float(sys.argv[2]), float(sys.argv[3]))
    elif cmd == "swipe":
        extra = [int(sys.argv[6])] if len(sys.argv) > 6 else []
        swipe(*[float(a) for a in sys.argv[2:6]], *extra)
    elif cmd == "frame":
        print(window_frame(), "->", to_screen(220, 478))
