import yfinance as yf
import pandas as pd
import requests
import json
import datetime
from urllib.request import Request, urlopen

def get_nasdaq_100_tickers():
    try:
        url = 'https://en.wikipedia.org/wiki/Nasdaq-100'
        headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"}
        response = requests.get(url, headers=headers)
        tables = pd.read_html(response.text)
        df = tables[4] # Usually the components table is the 5th table
        if 'Ticker' in df.columns:
            return df['Ticker'].tolist()
        elif 'Symbol' in df.columns:
            return df['Symbol'].tolist()
    except Exception as e:
        print(f"Error fetching Nasdaq 100 tickers: {e}")
    
    # Fallback to a hardcoded subset of top Nasdaq 100 if wiki fails
    return ['AAPL', 'MSFT', 'AMZN', 'NVDA', 'META', 'TSLA', 'GOOGL', 'GOOG', 'AVGO', 'PEP', 'COST', 'CSCO', 'TMUS', 'ADBE', 'TXN', 'CMCSA', 'AMD', 'NFLX', 'INTC', 'HON', 'QCOM', 'INTU', 'AMGN', 'SBUX', 'ISRG', 'GILD', 'BKNG', 'MDLZ', 'VRTX', 'REGN']

def get_fear_and_greed_history():
    # Attempt to fetch CNN Fear & Greed historical data
    url = "https://production.dataviz.cnn.io/index/fearandgreed/graphdata"
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36",
        "Accept": "application/json"
    }
    try:
        response = requests.get(url, headers=headers)
        data = response.json()
        fg_data = data['fear_and_greed_historical']['data']
        # Convert to daily mapping: { 'YYYY-MM-DD': value }
        fg_dict = {}
        for item in fg_data:
            dt = datetime.datetime.fromtimestamp(item['x'] / 1000)
            date_str = dt.strftime('%Y-%m-%d')
            fg_dict[date_str] = item['y']
        return fg_dict
    except Exception as e:
        print(f"Error fetching Fear & Greed: {e}")
        return {}

def main():
    # 1. Setup Dates
    end_date = datetime.date.today()
    start_date = end_date - datetime.timedelta(days=365)
    
    # We need 2 years of data for 200MA and 52-week High/Low calculations
    fetch_start_date = start_date - datetime.timedelta(days=400)
    
    # 2. Fetch QQQ and VIX
    print("Fetching QQQ and VIX...")
    qqq = yf.download('QQQ', start=fetch_start_date, end=end_date)
    vix = yf.download('^VIX', start=fetch_start_date, end=end_date)
    
    if qqq.empty or vix.empty:
        print("Failed to download basic market data.")
        return

    # Calculate QQQ 50MA
    qqq['50MA'] = qqq['Close'].rolling(window=50).mean()
    
    # Filter to last 1 year
    qqq_1yr = qqq.loc[start_date:end_date]
    vix_1yr = vix.loc[start_date:end_date]
    
    # Extract aligned dates
    common_dates = qqq_1yr.index
    date_strs = [d.strftime('%Y-%m-%d') for d in common_dates]
    
    # 3. Fetch Nasdaq 100 Components
    tickers = get_nasdaq_100_tickers()
    tickers = [t.replace('.', '-') for t in tickers] # yfinance uses '-' for classes
    print(f"Fetching data for {len(tickers)} Nasdaq 100 components...")
    
    ndx_data = yf.download(tickers, start=fetch_start_date, end=end_date)['Close']
    
    # 4. Calculate % Above 200MA
    print("Calculating % Above 200MA...")
    ndx_200ma = ndx_data.rolling(window=200).mean()
    is_above_200ma = ndx_data > ndx_200ma
    # Percentage calculation: (count of True) / (count of non-NaN) * 100
    above_200ma_pct = (is_above_200ma.sum(axis=1) / ndx_data.notna().sum(axis=1)) * 100
    
    # 5. Calculate New Highs - New Lows (52-week)
    print("Calculating New Highs - New Lows...")
    # 52 weeks is approx 252 trading days
    ndx_52w_high = ndx_data.rolling(window=252).max()
    ndx_52w_low = ndx_data.rolling(window=252).min()
    
    # Consider it a new high if current price is >= 52w high
    # Actually, proper NH/NL uses daily high/lows, but closing prices are a close proxy
    new_highs_count = (ndx_data >= ndx_52w_high).sum(axis=1)
    new_lows_count = (ndx_data <= ndx_52w_low).sum(axis=1)
    nahl_series = new_highs_count - new_lows_count
    
    # 6. Fetch Fear & Greed
    print("Fetching Fear & Greed Index...")
    fg_dict = get_fear_and_greed_history()
    
    # 7. Assemble final data arrays
    output_dates = []
    output_qqq = []
    output_qqq50ma = []
    output_above200ma = []
    output_highLow = []
    output_vix = []
    output_fearGreed = []
    
    last_valid_fg = 50 # Default fallback
    
    for i, dt in enumerate(common_dates):
        date_str = dt.strftime('%Y-%m-%d')
        
        # Handle NaN values safely, extracting scalar values
        q_val_raw = qqq_1yr['Close'].iloc[i]
        q50_val_raw = qqq_1yr['50MA'].iloc[i]
        v_val_raw = vix_1yr['Close'].iloc[i]
        
        q_val_raw = q_val_raw.item() if isinstance(q_val_raw, pd.Series) else q_val_raw
        q50_val_raw = q50_val_raw.item() if isinstance(q50_val_raw, pd.Series) else q50_val_raw
        v_val_raw = v_val_raw.item() if isinstance(v_val_raw, pd.Series) else v_val_raw

        q_val = float(q_val_raw) if not pd.isna(q_val_raw) else (output_qqq[-1] if output_qqq else 0)
        q50_val = float(q50_val_raw) if not pd.isna(q50_val_raw) else (output_qqq50ma[-1] if output_qqq50ma else q_val)
        v_val = float(v_val_raw) if not pd.isna(v_val_raw) else (output_vix[-1] if output_vix else 20)
        
        a200_val = float(above_200ma_pct.loc[dt].item() if isinstance(above_200ma_pct.loc[dt], pd.Series) else above_200ma_pct.loc[dt]) if dt in above_200ma_pct.index and not pd.isna(above_200ma_pct.loc[dt]).any() else output_above200ma[-1] if output_above200ma else 50
        nhnl_val = int(nahl_series.loc[dt].item() if isinstance(nahl_series.loc[dt], pd.Series) else nahl_series.loc[dt]) if dt in nahl_series.index and not pd.isna(nahl_series.loc[dt]).any() else output_highLow[-1] if output_highLow else 0
        
        fg_val = fg_dict.get(date_str)
        if fg_val is not None:
            last_valid_fg = fg_val
        else:
            # If CNN doesn't have data for this specific day (e.g. holidays), carry forward
            pass
            
        output_dates.append(date_str)
        output_qqq.append(round(q_val, 2))
        output_qqq50ma.append(round(q50_val, 2))
        output_vix.append(round(v_val, 2))
        output_above200ma.append(round(a200_val, 2))
        output_highLow.append(nhnl_val)
        output_fearGreed.append(round(last_valid_fg, 2))

    # 8. Export to JSON
    data = {
        "dates": output_dates,
        "qqq": output_qqq,
        "qqq50ma": output_qqq50ma,
        "above200ma": output_above200ma,
        "highLow": output_highLow,
        "vix": output_vix,
        "fearGreed": output_fearGreed
    }
    
    with open('data.json', 'w') as f:
        json.dump(data, f)
        
    print("Successfully generated data.json")

if __name__ == "__main__":
    main()
