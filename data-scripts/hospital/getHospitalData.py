import json, datetime, os
import pandas as pd
import numpy as np

dir_path = os.path.dirname(os.path.realpath(__file__))
repo_root = os.path.abspath(os.path.join(dir_path, '..', '..'))

def get_last_sunday(delta=0):
	today = datetime.date.today()
	idx = (today.weekday() + 1) % 7
	sunday = today - datetime.timedelta(idx)
	return sunday.strftime("%Y%m%d")

def fetch_data():

	try:
		date = get_last_sunday()
		data = pd.read_csv("https://healthdata.gov/sites/default/files/reported_hospital_capacity_admissions_facility_level_weekly_average_timeseries_{}.csv".format(date))
		print("Data updated as of {}".format(date))
	except:
		date = get_last_sunday(delta=7)
		data = pd.read_csv("https://healthdata.gov/sites/default/files/reported_hospital_capacity_admissions_facility_level_weekly_average_timeseries_{}.csv".format(date))
		print("Data updated as of {}".format(date))


	colnames = ["hospital_pk",
	"collection_week",
	"hospital_name",
	"address",
	"city" ,
	"zip" ,
	"hospital_subtype", 
	"fips_code", 
	"all_adult_hospital_inpatient_beds_7_day_avg", 
	"inpatient_beds_used_7_day_avg", 
	"total_icu_beds_7_day_avg", 
	"icu_beds_used_7_day_avg",
	"total_adult_patients_hospitalized_confirmed_covid_7_day_avg"]
	
	data = data.loc[:,colnames]

	return data

def transposeDf(df):
    # thanks to @piRSquared on stackoverflow for this nifty pivot expressions
    # https://stackoverflow.com/questions/54915215/expressing-time-series-data-in-the-columns-rather-than-the-rows-of-a-dataframe
    df = df.pivot_table(index='fid', columns='collection_week').swaplevel(0, 1, 1).sort_index(1).reset_index()
    df.columns = [column[0] for column in list(df.columns)]
    df = df.replace(-999999.0, '')
    return df

if __name__ == "__main__": 
    currentData = fetch_data()
    joinDf = pd.read_csv(os.path.join(repo_root,'data-scripts/hospital/joinHospitalPK_FID.csv'))
    merged = currentData.merge(joinDf, how="left", on="hospital_pk")

    beds = merged[['fid','collection_week','all_adult_hospital_inpatient_beds_7_day_avg']]
    bedsUsed = merged[['fid','collection_week','inpatient_beds_used_7_day_avg']]
    icuBeds = merged[['fid','collection_week','total_icu_beds_7_day_avg']]
    icuBedsUsed = merged[['fid','collection_week','icu_beds_used_7_day_avg']]
    totalCases = merged[['fid','collection_week','total_adult_patients_hospitalized_confirmed_covid_7_day_avg']]

    transposeDf(beds).to_csv(os.path.join(repo_root, 'docs/csv/hospital_beds.csv'), index=False)
    transposeDf(bedsUsed).to_csv(os.path.join(repo_root, 'docs/csv/hospital_beds_used.csv'), index=False)
    transposeDf(icuBeds).to_csv(os.path.join(repo_root, 'docs/csv/hospital_icu_beds.csv'), index=False)
    transposeDf(icuBedsUsed).to_csv(os.path.join(repo_root, 'docs/csv/hospital_icu_beds_used.csv'), index=False)
    transposeDf(totalCases).to_csv(os.path.join(repo_root, 'docs/csv/hospital_cases.csv'), index=False)