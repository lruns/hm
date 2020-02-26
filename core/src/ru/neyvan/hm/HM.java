package ru.neyvan.hm;

import com.badlogic.gdx.Application;
import com.badlogic.gdx.Game;
import com.badlogic.gdx.Gdx;
import com.badlogic.gdx.Screen;
import com.badlogic.gdx.assets.AssetManager;
import com.badlogic.gdx.files.FileHandle;
import com.badlogic.gdx.utils.I18NBundle;

import java.util.Locale;

import ru.neyvan.hm.levels.LevelNumber;
import ru.neyvan.hm.managers.MusicManager;
import ru.neyvan.hm.managers.ShaderManager;
import ru.neyvan.hm.managers.SoundManager;
import ru.neyvan.hm.managers.TextureManager;
import ru.neyvan.hm.screens.MenuScreen;
import ru.neyvan.hm.screens.PlayScreen;
import ru.neyvan.hm.screens.WelcomeScreen;

/**
 * Created by AndyGo on 08.07.2017.
 */

public class HM extends Game {
    //	private int resolutions[][] = {
//			{ 800, 1280 },
//			{ 480, 800 },
//			{ 320, 480 }
//	};
//	public int resolutionI;
//	private String[] resname = { "hdpi", "mdpi", "ldpi" };
//	public int resolution[];
    public Settings settings;
    public final AssetManager manager = new AssetManager();
    public I18NBundle bundle;
    public TextureManager texture;
    public ShaderManager shader;
    public SoundManager sound;
    public MusicManager music;
    public Records records;
    public MenuFieldPainter menuFieldPainter;
    public Player player;
    public static HM game;


    @Override
    public void create() {
        game = this;
        Gdx.input.setCatchBackKey(true);
        Gdx.app.setLogLevel(Application.LOG_DEBUG);

        settings = new Settings();
        settings.readSettings();

        player = new Player();
        player.readName();

        records = new Records();
        records.readRecords();

        texture = new TextureManager();
        shader = new ShaderManager();
        sound = new SoundManager();
        music = new MusicManager();

        //settings.welcome = true;
        if(settings.welcome){
            setScreen(new WelcomeScreen());
        }else{
            initManagers();
            setScreen(new MenuScreen(MenuScreen.APPEARANCE_ELASTIC));
            //setScreen(new PlayScreen(new LevelNumber(1,1)));
        }
    }

    public void initManagers(){
        FileHandle fileHandle = Gdx.files.internal("i18n/Bundle");
        // ПОЗЖЕ УБЕРИ !!!!!!!!!!!!!!!!!!!!!
            Locale locale = new Locale("ru");
        //
        bundle = I18NBundle.createBundle(fileHandle, locale);
        texture.init();
        shader.init();
        sound.init();
        music.init();
        music.play();
        menuFieldPainter = new MenuFieldPainter();
    }

    float timeDebug = 0;
    float time = 0;
    float maxTime = 5;
    @Override
    public void render() {
        super.render();
//        if(Gdx.app.getLogLevel() == Application.LOG_DEBUG){
//            timeDebug += Gdx.graphics.getDeltaTime();
//            if(timeDebug > maxTime){
//                time+=timeDebug;
//                timeDebug = 0;
//                Gdx.app.debug("Time", time+"");
//                Gdx.app.debug("FPS", Gdx.graphics.getFramesPerSecond()+" S");
//                Gdx.app.debug("JavaHeap", Gdx.app.getJavaHeap()/1048576+" MB");
//                //Gdx.app.debug("NativeHeap", Gdx.app.getNativeHeap()/1048576+" MB");
//            }
//        }

    }

    @Override
    public void resize(int width, int height) {
        super.resize(width, height);
    }

    @Override
    public void dispose() {
        super.dispose();
        manager.dispose();
        texture.dispose();
        shader.dispose();
        sound.dispose();
        music.dispose();
    }

    public void setScreen (Screen screen) {
        if (this.screen != null){
            this.screen.hide();
            this.screen.dispose();
        }
        this.screen = screen;
        if (this.screen != null) {
            this.screen.show();
            this.screen.resize(Gdx.graphics.getWidth(), Gdx.graphics.getHeight());
        }
    }

}
