package ru.neyvan.hm.game;

import com.badlogic.gdx.Gdx;
import com.badlogic.gdx.files.FileHandle;
import com.badlogic.gdx.utils.Base64Coder;
import com.badlogic.gdx.utils.GdxRuntimeException;
import com.badlogic.gdx.utils.Json;

import ru.neyvan.hm.Constants;
import ru.neyvan.hm.levels.Level;
import ru.neyvan.hm.levels.LevelNumber;

class GameDataLoader {
    private Json json;
    private FileHandle fileHandle;

    public GameDataLoader(){
        json = new Json();
    }

    public GameData load() throws GdxRuntimeException {
        fileHandle = Gdx.files.internal(Constants.GAME_DATA_PATH);
        GameData gameData = json.fromJson(GameData.class,
                Base64Coder.decodeString(fileHandle.readString()));
        return gameData;
    }

    public void save(GameData gameData) throws GdxRuntimeException{
        fileHandle = Gdx.files.local(Constants.GAME_DATA_PATH);
        fileHandle.writeString(Base64Coder.encodeString(json.prettyPrint(gameData)),false);
    }
}
