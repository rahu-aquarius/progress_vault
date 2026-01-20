import requests
import asyncio

# Global variables
CURRENT_GUEST_PASSWORD = "00000.00"  # The answer key (e.g., "17101.28")
CURRENT_REFERENCE_PRICE = "00000.00"  # The hint (e.g., "82101.71")


def fetch_btc_price():
    """
    Fetches BTC/EUR.
    Returns Tuple: (AnswerKey, ReferencePrice)
    """
    url = "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=eur"
    try:
        response = requests.get(url, timeout=5)
        data = response.json()
        price = data["bitcoin"]["eur"]  # e.g., 82101.71

        # 1. Format to 2 decimals (This is our Reference Hint)
        reference_str = "{:.2f}".format(price)  # "82101.71" (8 chars)

        # 2. Reverse it completely for the Password
        # "82101.71" -> "17.10128"
        # WAIT. You want "17101.28".
        # That is NOT a pure reverse.

        # Your specific logic: "Reverse digits, Keep dot at pos 6"
        clean_digits = reference_str.replace(".", "")  # "8210171"
        reversed_digits = clean_digits[::-1]  # "1710128"

        # Reconstruct: 5 digits + dot + 2 digits
        password_str = reversed_digits[:-2] + "." + reversed_digits[-2:]

        return password_str, reference_str

    except Exception as e:
        print(f"Error fetching BTC: {e}")
        return None, None


async def update_password_task():
    global CURRENT_GUEST_PASSWORD, CURRENT_REFERENCE_PRICE
    while True:
        pass_val, ref_val = fetch_btc_price()
        if pass_val:
            CURRENT_GUEST_PASSWORD = pass_val
            CURRENT_REFERENCE_PRICE = ref_val
            print(f"--- [SEC] Ref: {ref_val} | Pass: {pass_val} ---")

        await asyncio.sleep(3600)  # 1 Hour
