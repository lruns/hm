package ru.neyvan.hm.levels;


import com.badlogic.gdx.Gdx;
import com.badlogic.gdx.files.FileHandle;
import com.badlogic.gdx.utils.Base64Coder;
import com.badlogic.gdx.utils.Json;

import javax.swing.JFileChooser;
import javax.swing.JFrame;
import javax.swing.filechooser.FileNameExtensionFilter;



public class MyFrame extends JFrame {

    public String message;
    public boolean allOk;
    Json json;
    FileHandle fileHandle;
    MyFrame() {

    }
    public Level openFile(){
        JFileChooser dialog = new JFileChooser();
        FileNameExtensionFilter filter = new FileNameExtensionFilter(
                "Level Files (*.lvl)", "lvl");
        dialog.setFileFilter(filter);
        dialog.setFileSelectionMode(JFileChooser.FILES_AND_DIRECTORIES);
        dialog.setApproveButtonText("Open");//выбрать название для кнопки согласия
        dialog.setDialogTitle("Level Open");// выбрать название
        dialog.setDialogType(JFileChooser.OPEN_DIALOG);// выбрать тип диалога Open или Save
        dialog.setMultiSelectionEnabled(false); // Разрешить выбор нескольки файлов
        dialog.showOpenDialog(this);
        //this.dispose();

        Level level = null;
        try {
            json = new Json();
            fileHandle = Gdx.files.absolute(dialog.getSelectedFile().getAbsolutePath());
            level = json.fromJson(Level.class,
                    Base64Coder.decodeString(fileHandle.readString()));
        } catch (Exception e) {
            System.out.println("Exception thrown during open file: " + e.toString());
        }
        return level;
    }
    public boolean saveFile(Level level){
        JFileChooser fileChooser = new JFileChooser();
        FileNameExtensionFilter filter = new FileNameExtensionFilter(
                "Level Files (*.lvl)", "lvl");
        fileChooser.setFileFilter(filter);
//        dialog.setFileSelectionMode(JFileChooser.FILES_AND_DIRECTORIES);
//        dialog.setApproveButtonText("Open");//выбрать название для кнопки согласия
//        dialog.setDialogTitle("Level Open");// выбрать название
//        dialog.setDialogType(JFileChooser.SAVE_DIALOG);// выбрать тип диалога Open или Save
//        dialog.setMultiSelectionEnabled(false); // Разрешить выбор нескольки файлов
//        dialog.showSaveDialog(this);
        fileChooser.setDialogTitle("Сохранение файла");
        // Определение режима - только файл
        fileChooser.setFileSelectionMode(JFileChooser.FILES_ONLY);
        int result = fileChooser.showSaveDialog(MyFrame.this);
        // Если файл выбран, то представим его в сообщении
        if (result == JFileChooser.APPROVE_OPTION ) {
            allOk = true;
            try {
                String text = fileChooser.getSelectedFile()+"";
                if(!text.contains(".lvl")){
                    text+=".lvl";
                }
                json = new Json();
                fileHandle = Gdx.files.absolute(text);
                fileHandle.writeString(Base64Coder.encodeString(json.prettyPrint(level)),false);
            } catch (Exception ex) {
                message = ex.toString();
                allOk =false;
            }
            return allOk;
        }

        return false;
    }
}