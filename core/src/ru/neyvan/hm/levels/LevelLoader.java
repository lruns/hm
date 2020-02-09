package ru.neyvan.hm.levels;

public class LevelLoader{
	private JSON json;
	private FileHandler fileHandler;

	public LevelLoader(){
    	json = new Json();
	}

	public Level load(int i_episode, int i_level) throws GdxRuntimeException {
		String path = "episodes/episode"+i_episode+"/level"+i_level+".lvl";
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