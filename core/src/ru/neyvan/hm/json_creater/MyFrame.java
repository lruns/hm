package ru.neyvan.hm.json_creater;

import com.badlogic.gdx.Gdx;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.FileWriter;
import java.io.IOException;
import java.io.ObjectInputStream;
import java.io.ObjectOutputStream;
import java.util.ArrayList;

import javax.swing.JFileChooser;
import javax.swing.JFrame;
import javax.swing.JOptionPane;
import javax.swing.filechooser.FileNameExtensionFilter;

public class MyFrame extends JFrame {
    private final String[] FILTER = {"json", "Level Files (*.json)"};
    public String message;
    public boolean allOk;
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
            FileInputStream fis = new FileInputStream(dialog.getSelectedFile());
            ObjectInputStream ois = new ObjectInputStream(fis);
            level = (Level) ois.readObject();
            ois.close();

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
            FileOutputStream fout = null;
            ObjectOutputStream oos = null;
            try {
                String text = fileChooser.getSelectedFile()+"";
                if(!text.contains(".lvl")){
                    text+=".lvl";
                }
                fout = new FileOutputStream(text);
                oos = new ObjectOutputStream(fout);
                oos.writeObject(level);
            } catch (Exception ex) {
                message = ex.toString();
                allOk =false;
            } finally {
                if (fout != null) {
                    try {
                        fout.close();
                    } catch (IOException e) {
                        e.printStackTrace();
                    }
                }
                if (oos != null) {
                    try {
                        oos.close();
                    } catch (IOException e) {
                        e.printStackTrace();
                    }
                }
            }
            return allOk;
        }

        return false;
    }
}