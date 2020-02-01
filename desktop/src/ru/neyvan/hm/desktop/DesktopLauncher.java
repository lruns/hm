package ru.neyvan.hm.desktop;

import com.badlogic.gdx.backends.lwjgl.LwjglApplication;
import com.badlogic.gdx.backends.lwjgl.LwjglApplicationConfiguration;
import com.badlogic.gdx.tools.texturepacker.TexturePacker;

import ru.neyvan.hm.Constants;
import ru.neyvan.hm.HM;

public class DesktopLauncher {
	static boolean reloadAtlas = false;
	public static void main (String[] arg) {
		LwjglApplicationConfiguration config = new LwjglApplicationConfiguration();
		config.width = (int) (Constants.WIDTH*0.8);
		config.height = (int) (Constants.HEIGHT*0.8);
		config.title = "Happy Math";
		if(reloadAtlas){
			TexturePacker.process("android/assets/src", "android/assets/", "game_atlas");
			System.out.println("TexturePacker finished");
		}
		new LwjglApplication(new HM(), config);
	}
}
