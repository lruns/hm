package ru.neyvan.hm;

import com.badlogic.gdx.Gdx;
import com.badlogic.gdx.Preferences;

import ru.neyvan.hm.levels.LevelNumber;

import static ru.neyvan.hm.Constants.PLAYER_PATH;

/**
 * Created by AndyGo on 13.10.2017.
 */

public class Player {

    private String name;
    private Preferences preferences;

    public Player(){
        preferences = Gdx.app.getPreferences(PLAYER_PATH);
    }

    public void readName(){
        name = preferences.getString("name", "");
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
        preferences.putString("name", name);
        preferences.flush();
        Gdx.app.debug("new name", name);
        return true;
    }
    private boolean isErrorName(String name){
        return name.equals(HM.game.bundle.get("yourName")) || name.equals(HM.game.bundle.get("yourRename")) || name.trim().isEmpty();
    }

    public boolean isPlayerExist() {
        Gdx.app.debug("name is", String.valueOf(!isErrorName(name)));
        return !isErrorName(name);
    }

    public boolean isGameExist() {
        return preferences.getBoolean("game_exist", false);
    }

    public void createGame() {
        preferences.putBoolean("game_exist", true);
        preferences.flush();
    }

    public void deleteGame() {
        preferences.putBoolean("game_exist", false);
        preferences.flush();
    }


    public boolean isOpened(LevelNumber levelNumber) {
        boolean open = false;
        if(levelNumber.getEpisode() == 1) open = preferences.getBoolean("episode"+levelNumber.getEpisode(), true);
        else open = preferences.getBoolean("episode"+levelNumber.getEpisode(), false);
        return open;
    }

    // You complete episode and open new episode
    public void  openEpisode(LevelNumber levelNumber){
        preferences.putBoolean("episode"+levelNumber.getEpisode(), true);
        Gdx.app.debug("openEpisode"+levelNumber.getEpisode(), preferences.getBoolean("episode"+levelNumber.getEpisode())+"");
        preferences.flush();
    }

}
