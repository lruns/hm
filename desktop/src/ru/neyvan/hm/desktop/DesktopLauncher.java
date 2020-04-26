package ru.neyvan.hm.desktop;

import com.badlogic.gdx.backends.lwjgl.LwjglApplication;
import com.badlogic.gdx.backends.lwjgl.LwjglApplicationConfiguration;
import com.badlogic.gdx.tools.texturepacker.TexturePacker;

import ru.neyvan.hm.HM;

public class DesktopLauncher {
	static boolean reloadAtlas = false;
	public static void main (String[] arg) {
		LwjglApplicationConfiguration config = new LwjglApplicationConfiguration();
		config.width = (int) (480*0.7f);
		config.height = (int) (960*0.7f);
		config.title = "Happy Math";
		if(reloadAtlas){
			TexturePacker.process("android/assets/src", "android/assets/", "game_atlas");
			System.out.println("TexturePacker finished");
		}
		new LwjglApplication(new HM(), config);
	}
}
