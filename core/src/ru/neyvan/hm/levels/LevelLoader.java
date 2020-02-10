package ru.neyvan.hm.levels;

import com.badlogic.gdx.Gdx;
import com.badlogic.gdx.files.FileHandle;
import com.badlogic.gdx.utils.Base64Coder;
import com.badlogic.gdx.utils.GdxRuntimeException;
import com.badlogic.gdx.utils.Json;


public class LevelLoader{
	private Json json;
	private FileHandle fileHandle;

	public LevelLoader(){
    	json = new Json();
	}

	public Level load(LevelNumber levelNumber) throws GdxRuntimeException {
		String path = "episodes/episode"+levelNumber.getEpisode()+"/level"+levelNumber.getLevel()+".lvl";
		fileHandle = Gdx.files.internal(path);
        Level level = json.fromJson(Level.class,
                    Base64Coder.decodeString(fileHandle.readString()));
		return level;
	}

	public Level load(String absolutePath) throws GdxRuntimeException {
		fileHandle = Gdx.files.absolute(absolutePath);
        Level level = json.fromJson(Level.class,
                    Base64Coder.decodeString(fileHandle.readString()));
        return level;
	}

	public void save(Level level, String absolutePath) throws GdxRuntimeException{
		fileHandle = Gdx.files.absolute(absolutePath);
		fileHandle.writeString(Base64Coder.encodeString(json.prettyPrint(level)),false);
	}
}