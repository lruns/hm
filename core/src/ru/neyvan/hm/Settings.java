package ru.neyvan.hm;

import com.badlogic.gdx.Gdx;
import com.badlogic.gdx.Preferences;

/**
 * Created by AndyGo on 04.07.2017.
 */

public class Settings {
    private String preferencesName = "ru.neyvan.hm_s";
    public boolean isMusic;
    public boolean isSound;
    public float music;
    public float sound;
    public boolean welcome;


    public void readSettings(){
        Preferences preferences = Gdx.app.getPreferences(preferencesName);
        isMusic = preferences.getBoolean("is_music", true);
        isSound = preferences.getBoolean("is_sound", true);
        music = preferences.getFloat("music", 0.5f);
        sound = preferences.getFloat("sound", 0.5f);
        welcome = preferences.getBoolean("welcome", true);
        welcome = false;
        isMusic = false;
        preferences = null;
    }
    public void writeSettings(){
        Preferences preferences = Gdx.app.getPreferences(preferencesName);
        preferences.putBoolean("is_music", isMusic);
        preferences.putBoolean("is_sound", isSound);
        preferences.putFloat("music", music);
        preferences.getFloat("sound", sound);
        preferences.putBoolean("welcome", welcome);
        preferences.flush();
        preferences = null;
    }
}
