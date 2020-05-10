package ru.neyvan.hm.game;

import com.badlogic.gdx.Gdx;
import com.badlogic.gdx.files.FileHandle;
import com.badlogic.gdx.utils.Base64Coder;
import com.badlogic.gdx.utils.GdxRuntimeException;
import com.badlogic.gdx.utils.Json;
import com.badlogic.gdx.Preferences;

import ru.neyvan.hm.Constants;

public class GameDataLoader {
    private Json json;
    private FileHandle fileHandle;

    public GameDataLoader(){
        json = new Json();
    }

    public GameData load() throws GdxRuntimeException {
        if(Constants.gwt){
            Preferences saves = Gdx.app.getPreferences(Constants.GAME_DATA_PATH);
            String saveString = saves.getString("save", "null");
            GameData gameData = json.fromJson(GameData.class,
                    Base64Coder.decodeString(saveString));
            Gdx.app.log("GameDataLoader","Game load");
            return gameData;
        }else{
            fileHandle = Gdx.files.local(Constants.GAME_DATA_PATH);
            GameData gameData = json.fromJson(GameData.class,
                    Base64Coder.decodeString(fileHandle.readString()));
            return gameData;
        }
    }

    public void save(GameData gameData) throws GdxRuntimeException{
        if(Constants.gwt){
            Preferences saves = Gdx.app.getPreferences(Constants.GAME_DATA_PATH);
            saves.putString("save", Base64Coder.encodeString(json.prettyPrint(gameData)));
            saves.flush();
            Gdx.app.log("GameDataLoader","Game save");
        }else{
            fileHandle = Gdx.files.local(Constants.GAME_DATA_PATH);
            fileHandle.writeString(Base64Coder.encodeString(json.prettyPrint(gameData)),false);
        }

    }
}
