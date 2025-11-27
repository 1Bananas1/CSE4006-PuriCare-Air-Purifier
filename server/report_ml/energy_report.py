# energy_report.py

from datetime import date, datetime
from pathlib import Path
import time
import pandas as pd

PRICE_PER_KWH = 360  # 1kWh당 요금(원)

# 이 파일(server/report_ml/energy_report.py)을 기준으로 한 경로
BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"

# 기본 데이터 경로
DEFAULT_APPLIANCES_CSV = DATA_DIR / "KAG_energydata_complete.csv"
DEFAULT_HOUSEHOLD_CSV = DATA_DIR / "household_power_consumption.csv"

# 요일명 (평균/피크시간대 메시지용)
WEEKDAY_NAMES_KO = ["월", "화", "수", "목", "금", "토", "일"]


def load_hourly_data(csv_path: str | Path) -> pd.DataFrame:
    """
    Kaggle Appliances Energy 데이터에서
    1시간 단위 energy_kwh 시계열을 만들어 반환
    """
    df = pd.read_csv(str(csv_path))

    # 문자열 날짜를 datetime으로 변환
    df["datetime"] = pd.to_datetime(df["date"])

    # datetime을 인덱스로 설정
    df = df.set_index("datetime")

    # 1시간 단위로 Wh 합산
    hourly_wh = (
        df["Appliances"]
        .resample("1h")
        .sum()
    )

    # DataFrame으로 변환 + kWh 컬럼 추가
    hourly = hourly_wh.to_frame(name="energy_wh")
    hourly["energy_kwh"] = hourly["energy_wh"] / 1000.0

    # datetime을 다시 컬럼으로
    hourly = hourly.reset_index()

    return hourly


def build_pattern_table(hourly: pd.DataFrame) -> pd.DataFrame:
    """
    요일(weekday) × 시간대(hour)별 평균 energy_kwh 패턴 테이블 생성
    """
    hourly = hourly.copy()
    hourly["weekday"] = hourly["datetime"].dt.weekday
    hourly["hour"] = hourly["datetime"].dt.hour

    pattern = (
        hourly
        .groupby(["weekday", "hour"])["energy_kwh"]
        .mean()
        .reset_index()
    )
    return pattern


def build_series_for_date(pattern: pd.DataFrame, report_date: date) -> list[dict]:
    """
    주어진 날짜(report_date)의 요일에 해당하는 24개 패턴을
    [{ts, value}] 리스트 형태로 반환
    """
    weekday = report_date.weekday()

    today_pattern = (
        pattern[pattern["weekday"] == weekday]
        .sort_values("hour")
    )

    series: list[dict] = []
    for _, row in today_pattern.iterrows():
        hour = int(row["hour"])
        value = float(row["energy_kwh"])

        dt = datetime(report_date.year, report_date.month, report_date.day, hour, 0, 0)
        ts_ms = int(time.mktime(dt.timetuple()) * 1000)

        series.append({"ts": ts_ms, "value": value})

    return series


def build_today_summary(hourly: pd.DataFrame, report_date: date) -> dict:
    """
    report_date 기준 하루 사용량(kWh), 요금(원), 절감률(%) 계산
    절감률 = 같은 요일들의 평균 대비 증감률
    """
    # report_date 하루만 필터
    mask_today = hourly["datetime"].dt.date == report_date
    today_hourly = hourly[mask_today]

    today_kwh = today_hourly["energy_kwh"].sum()
    today_cost = today_kwh * PRICE_PER_KWH

    # 같은 요일의 다른 날짜들 평균
    weekday = report_date.weekday()
    mask_weekday = hourly["datetime"].dt.weekday == weekday
    same_weekday = hourly[mask_weekday]

    # 날짜별 합계를 구하고, 그 평균을 "기준"으로 사용
    daily_kwh_by_date = (
        same_weekday
        .groupby(same_weekday["datetime"].dt.date)["energy_kwh"]
        .sum()
    )
    avg_kwh_same_weekday = daily_kwh_by_date.mean()

    if avg_kwh_same_weekday == 0:
        saving_percent = 0.0
    else:
        saving_percent = (
            (avg_kwh_same_weekday - today_kwh)
            / avg_kwh_same_weekday * 100
        )

    return {
        "usage": round(today_kwh, 2),
        "cost": int(today_cost),
        "savingPercent": round(saving_percent, 1),
    }


def build_weekly_forecast(hourly: pd.DataFrame) -> dict:
    """
    최근 4주 사용량으로 다음 주 사용량을 예측하고,
    지난 주 대비 증감률과 메시지를 생성
    """
    hourly = hourly.copy()
    iso = hourly["datetime"].dt.isocalendar()
    hourly["year"] = iso.year
    hourly["week"] = iso.week

    weekly = (
        hourly
        .groupby(["year", "week"])["energy_kwh"]
        .sum()
        .reset_index()
        .sort_values(["year", "week"])
    )

    # 데이터가 적을 경우 대비
    if len(weekly) == 0:
        return {
            "nextWeekUsage": 0.0,
            "lastWeekUsage": 0.0,
            "changePercent": 0.0,
            "message": "데이터가 부족하여 예측을 수행할 수 없습니다.",
        }

    last_weeks = weekly.tail(4).copy()
    last_week_usage = float(last_weeks.iloc[-1]["energy_kwh"])
    next_week_usage = float(last_weeks["energy_kwh"].mean())

    if last_week_usage == 0:
        change_percent = 0.0
    else:
        change_percent = (
            (next_week_usage - last_week_usage)
            / last_week_usage * 100
        )

    # 메시지 생성 (룰 기반)
    if change_percent > 5:
        message = "다음 주 에너지 사용량이 지난 주보다 증가할 것으로 예상됩니다."
    elif change_percent < -5:
        message = "다음 주 에너지 사용량이 지난 주보다 감소할 것으로 예상됩니다."
    else:
        message = "다음 주 에너지 사용량은 지난 주와 비슷한 수준으로 예상됩니다."

    return {
        "nextWeekUsage": round(next_week_usage, 2),
        "lastWeekUsage": round(last_week_usage, 2),
        "changePercent": round(change_percent, 2),
        "message": message,
    }


# ---------------------------------------------------------
# 추가 인사이트용 유틸 함수들
# ---------------------------------------------------------

def summarize_peak_hours(pattern: pd.DataFrame) -> dict:
    """
    요일×시간대 패턴에서 가장 많이/적게 사용하는 시간대 요약
    """
    idx_max = pattern["energy_kwh"].idxmax()
    idx_min = pattern["energy_kwh"].idxmin()

    row_max = pattern.loc[idx_max]
    row_min = pattern.loc[idx_min]

    max_weekday = int(row_max["weekday"])
    max_hour = int(row_max["hour"])
    max_value = float(row_max["energy_kwh"])

    min_weekday = int(row_min["weekday"])
    min_hour = int(row_min["hour"])
    min_value = float(row_min["energy_kwh"])

    max_msg = f"가장 에너지를 많이 쓰는 시간대는 {WEEKDAY_NAMES_KO[max_weekday]}요일 {max_hour}시대입니다."
    min_msg = f"가장 적게 사용하는 시간대는 {WEEKDAY_NAMES_KO[min_weekday]}요일 {min_hour}시대입니다."

    return {
        "peak": {
            "weekday": max_weekday,
            "weekdayName": WEEKDAY_NAMES_KO[max_weekday],
            "hour": max_hour,
            "value": round(max_value, 3),
        },
        "valley": {
            "weekday": min_weekday,
            "weekdayName": WEEKDAY_NAMES_KO[min_weekday],
            "hour": min_hour,
            "value": round(min_value, 3),
        },
        "message": max_msg + " " + min_msg,
    }


def summarize_weekday_weekend(hourly: pd.DataFrame) -> dict:
    """
    1시간 단위 hourly 데이터에서 일 단위로 합산 후,
    평일/주말 평균 사용량 비교
    """
    df = hourly.copy()
    df["date"] = df["datetime"].dt.date

    daily = (
        df.groupby("date")["energy_kwh"]
        .sum()
        .reset_index()
    )
    daily["weekday"] = pd.to_datetime(daily["date"]).dt.weekday

    weekday_mask = daily["weekday"] < 5
    weekend_mask = daily["weekday"] >= 5

    weekday_mean = float(daily.loc[weekday_mask, "energy_kwh"].mean())
    weekend_mean = float(daily.loc[weekend_mask, "energy_kwh"].mean())

    diff = weekend_mean - weekday_mean
    if weekday_mean > 0:
        diff_percent = diff / weekday_mean * 100
    else:
        diff_percent = 0.0

    if diff_percent > 5:
        msg = "주말 사용량이 평일보다 전반적으로 높은 편입니다."
    elif diff_percent < -5:
        msg = "평일 사용량이 주말보다 전반적으로 높은 편입니다."
    else:
        msg = "평일과 주말 사용량이 비슷한 수준입니다."

    return {
        "weekdayAvg": round(weekday_mean, 2),
        "weekendAvg": round(weekend_mean, 2),
        "diffPercent": round(diff_percent, 1),
        "message": msg,
    }


def summarize_recent_weeks(hourly: pd.DataFrame) -> dict:
    """
    최근 2주의 주간 사용량을 비교 (이번 주 vs 지난 주)
    """
    df = hourly.copy()
    iso = df["datetime"].dt.isocalendar()
    df["year"] = iso.year
    df["week"] = iso.week

    weekly = (
        df.groupby(["year", "week"])["energy_kwh"]
        .sum()
        .reset_index()
        .sort_values(["year", "week"])
    )

    if len(weekly) < 2:
        return {
            "thisWeek": 0.0,
            "lastWeek": 0.0,
            "changePercent": 0.0,
            "message": "주간 비교를 수행하기에 데이터가 충분하지 않습니다.",
        }

    last_two = weekly.tail(2).reset_index(drop=True)
    last_week_usage = float(last_two.loc[0, "energy_kwh"])
    this_week_usage = float(last_two.loc[1, "energy_kwh"])

    if last_week_usage == 0:
        change_percent = 0.0
    else:
        change_percent = (this_week_usage - last_week_usage) / last_week_usage * 100

    if change_percent > 5:
        msg = "최근 주간 에너지 사용량이 이전 주보다 증가했습니다."
    elif change_percent < -5:
        msg = "최근 주간 에너지 사용량이 이전 주보다 감소했습니다."
    else:
        msg = "최근 두 주의 에너지 사용량은 비슷한 수준입니다."

    return {
        "thisWeek": round(this_week_usage, 2),
        "lastWeek": round(last_week_usage, 2),
        "changePercent": round(change_percent, 1),
        "message": msg,
    }


def build_insights(hourly: pd.DataFrame, pattern: pd.DataFrame) -> dict:
    """
    리포트 화면에서 사용할 추가 인사이트들을 한 번에 생성.
    - 피크/최소 시간대
    - 평일 vs 주말 사용량 비교
    - 최근 주간 비교
    (여기에 일반 가정 비교도 아래에서 추가)
    """
    peak_info = summarize_peak_hours(pattern)
    weekday_weekend_info = summarize_weekday_weekend(hourly)
    recent_weeks_info = summarize_recent_weeks(hourly)

    return {
        "peakHours": peak_info,
        "weekdayWeekend": weekday_weekend_info,
        "recentWeeks": recent_weeks_info,
    }


# ---------------------------------------------------------
# UCI Household 데이터 기반 "일반 가정" 비교
# ---------------------------------------------------------

def load_household_hourly(csv_path: str | Path) -> pd.DataFrame:
    """
    UCI household_power_consumption.csv를 1시간 단위 kWh로 변환
    """
    df = pd.read_csv(
        str(csv_path),
        sep=";",          # UCI 데이터는 세미콜론 구분
        na_values="?",
        low_memory=False,
    )

    # 컬럼명 소문자
    df.columns = [c.lower() for c in df.columns]

    # datetime 생성
    df["datetime"] = pd.to_datetime(
        df["date"] + " " + df["time"],
        dayfirst=True,
    )

    # kW 컬럼 숫자형
    df["global_active_power"] = pd.to_numeric(
        df["global_active_power"],
        errors="coerce",
    )

    # 인덱스 설정 후 1시간 단위 kWh
    df = df.set_index("datetime")
    hourly_sum = df["global_active_power"].resample("1h").sum()
    hourly_kwh = hourly_sum / 60.0  # kW·min → kWh

    hourly = (
        hourly_kwh
        .to_frame(name="energy_kwh")
        .reset_index()
    )
    return hourly


def summarize_household_comparison(
    appliances_hourly: pd.DataFrame,
    house_hourly: pd.DataFrame,
) -> dict:
    """
    Kaggle Appliances(우리 데이터) vs
    UCI Household(일반 가정) 사용량 비교 인사이트
    """
    app_daily = (
        appliances_hourly
        .assign(date=lambda df: df["datetime"].dt.date)
        .groupby("date")["energy_kwh"]
        .sum()
    )

    house_daily = (
        house_hourly
        .assign(date=lambda df: df["datetime"].dt.date)
        .groupby("date")["energy_kwh"]
        .sum()
    )

    app_mean = float(app_daily.mean())
    house_mean = float(house_daily.mean())

    if house_mean > 0:
        diff_percent = (app_mean - house_mean) / house_mean * 100
    else:
        diff_percent = 0.0

    if diff_percent > 5:
        msg = "우리 가정은 일반 가정보다 전력 사용량이 높은 편입니다."
    elif diff_percent < -5:
        msg = "우리 가정은 일반 가정보다 전력 사용량이 적은, 비교적 효율적인 소비 패턴을 보입니다."
    else:
        msg = "우리 가정의 전력 사용량은 일반 가정 평균과 비슷한 수준입니다."

    return {
        "ourAvgKwh": round(app_mean, 2),
        "householdAvgKwh": round(house_mean, 2),
        "diffPercent": round(diff_percent, 1),
        "message": msg,
        "source": "UCI Household Power Consumption",
    }


# ---------------------------------------------------------
# 최종 리포트 생성
# ---------------------------------------------------------

def build_report(
    csv_path: str | Path | None = None,
    report_date: date | None = None,
) -> dict:
    """
    전체 리포트 JSON을 한 번에 생성하는 메인 함수
    백엔드는 이 함수만 호출하면 됨
    """
    # csv_path가 없으면 기본 Kaggle 데이터 사용
    if csv_path is None:
        csv_path = DEFAULT_APPLIANCES_CSV

    hourly = load_hourly_data(csv_path)
    pattern = build_pattern_table(hourly)

    # report_date가 없으면 데이터의 가장 마지막 날짜를 "오늘"로 사용
    if report_date is None:
        report_date = hourly["datetime"].dt.date.max()

    series = build_series_for_date(pattern, report_date)
    today_summary = build_today_summary(hourly, report_date)
    forecast = build_weekly_forecast(hourly)

    # 추가 인사이트(피크/평일·주말/최근주)
    insights = build_insights(hourly, pattern)

    # 일반 가정(UCI)과 비교 인사이트 추가 (파일 없으면 조용히 무시)
    try:
        house_hourly = load_household_hourly(DEFAULT_HOUSEHOLD_CSV)
        comparison = summarize_household_comparison(hourly, house_hourly)
        insights["householdComparison"] = comparison
    except FileNotFoundError:
        # 데이터 파일이 없으면 이 비교만 생략
        pass
    except Exception:
        # 예측 전체를 망치지 않기 위해 비교 인사이트 실패 시에도 무시
        pass

    report = {
        "range": "day",
        "usage": today_summary["usage"],
        "cost": today_summary["cost"],
        "savingPercent": today_summary["savingPercent"],
        "series": series,
        "forecast": forecast,
        "reportDate": report_date.isoformat(),
        "insights": insights,
    }
    return report


if __name__ == "__main__":
    # 테스트용 실행
    r = build_report()
    print(r)
