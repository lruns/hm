package ru.neyvan.hm.json_creater;

import com.badlogic.gdx.Graphics;
import com.badlogic.gdx.files.FileHandle;
import com.badlogic.gdx.utils.Array;
import java.io.File;
import java.util.List;

public interface DesktopWorker {
    public File openDialog(String title, String defaultPath, String[] filterPatterns, String filterDescription);
    public File saveDialog(String title, String defaultPath, String[] filterPatterns, String filterDescription);
}
