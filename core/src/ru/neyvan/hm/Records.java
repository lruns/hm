package ru.neyvan.hm;

import com.badlogic.gdx.Gdx;
import com.badlogic.gdx.Preferences;

/**
 * Created by AndyGo on 11.09.2017.
 */

public class Records {
    public static final int MAX_RECORDSMEN = 5;
    private String recordsName = "ru.elsohome_HMR";
    private String[] names;
    private int[] records;
    private int newRecordsman;
    private int lastGameScore;

    public Records(){
        names = new String[MAX_RECORDSMEN];
        records = new int[MAX_RECORDSMEN];
    }

    public void readRecords(){
        Preferences preferences = Gdx.app.getPreferences(recordsName);

        names[0] = preferences.getString("name0", "John");
        names[1] = preferences.getString("name1", "Angela");
        names[2] = preferences.getString("name2", "Walcott");
        names[3] = preferences.getString("name3", "Ashby");
        names[4] = preferences.getString("name4", "Hagan");

        records[0] = preferences.getInteger("record0", 500);
        records[1] = preferences.getInteger("record1", 400);
        records[2] = preferences.getInteger("record2", 250);
        records[3] = preferences.getInteger("record3", 150);
        records[4] = preferences.getInteger("record4", 50);

        preferences = null;
    }
    public void setNewRecordsman(){
        names[newRecordsman] = HM.game.player.getName();
        Preferences preferences = Gdx.app.getPreferences(recordsName);
        for (int i = 0; i < MAX_RECORDSMEN; i++){
            preferences.putString("name"+i, names[i]);
            preferences.putInteger("record"+i, records[i]);
        }
        preferences.flush();
        preferences = null;
    }
    public void writeLastGameScore(int score){
        lastGameScore = score;
    }
    public int getLastGameScore(){
        return lastGameScore;
    }


    public boolean checkWinScore(){
        newRecordsman = -1;
        for(int i = MAX_RECORDSMEN-1; i >= 0 ; i--){
            if(records[i] < lastGameScore){
                newRecordsman = i;
            }else{
                if(newRecordsman == -1)break;
                for(int ii = MAX_RECORDSMEN-1; ii>newRecordsman; ii--){
                    names[ii] = names[ii-1];
                    records[ii]=records[ii-1];
                }
                names[newRecordsman] = "";
                records[newRecordsman] = lastGameScore;
                break;
            }
        }
        return newRecordsman != -1;
    }
    public String getName(int iName){
        if(0<=iName && iName<MAX_RECORDSMEN){
            return names[iName];
        }
        return "Error: iName != "+iName;
    }
    public int getRecord(int iRecord){
        if(0<=iRecord && iRecord<MAX_RECORDSMEN){
            return records[iRecord];
        }
        return -1;
    }
    public int getNewRecordsman() {
        return newRecordsman;
    }
}
