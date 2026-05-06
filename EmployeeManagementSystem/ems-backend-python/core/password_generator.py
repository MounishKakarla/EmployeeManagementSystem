"""
Password generator — matches GeneratePassword.java.
"""

import secrets
import string


def generate_password(length: int = 8) -> str:
    if length < 8:
        raise ValueError("Min length 8")

    upper = string.ascii_uppercase
    lower = string.ascii_lowercase
    digit = string.digits
    special = "@$!%*?&"
    all_chars = upper + lower + digit + special

    # Guarantee at least one of each category
    pw = [
        secrets.choice(upper),
        secrets.choice(lower),
        secrets.choice(digit),
        secrets.choice(special),
    ]
    for _ in range(length - 4):
        pw.append(secrets.choice(all_chars))

    # Shuffle
    result = list(pw)
    secrets.SystemRandom().shuffle(result)
    return "".join(result)
