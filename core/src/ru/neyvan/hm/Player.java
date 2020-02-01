package ru.neyvan.hm;

import com.badlogic.gdx.Gdx;
import com.badlogic.gdx.Preferences;

/**
 * Created by AndyGo on 13.10.2017.
 */

public class Player {
    private String preferencesName = "ru.elsohomeHMPD";
    private String name;


    public void readName(){
        Preferences preferences = Gdx.app.getPreferences(preferencesName);
        name = preferences.getString("name", "");
        preferences = null;
        Gdx.app.debug("read name", name);
    }
    public String getName(){
        return name;
    }
    public boolean writeName(String name){
        if(isErrorName(name)){
            Gdx.app.debug("new name", "is error name");
            return false;
        }
        this.name = name;
        Preferences preferences = Gdx.app.getPreferences(preferencesName);
        preferences.putString("name", name);
        preferences.flush();
        preferences = null;
        Gdx.app.debug("new name", name);
        return true;
    }
    private boolean isErrorName(String name){
        return name.equals("Your Name") || name.equals("Your New Name") || name.trim().isEmpty();
    }

    public boolean isPlayerExist() {
        Gdx.app.debug("name is", String.valueOf(!isErrorName(name)));
        return !isErrorName(name);
    }
}
