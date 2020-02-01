package ru.neyvan.hm.json_creater;

import com.badlogic.gdx.Gdx;

import java.io.*;
import java.util.ArrayList;
 
public class FilesApp {
 
    public static void main(String[] args) {
        
        String filename = "people.dat";
        // создадим список объектов, которые будем записывать
        ArrayList<Person> people = new ArrayList();
        ArrayList nums = new ArrayList();
        nums.add(13232);
        nums.add(32423423);
        people.add(new Person("Том", 30, nums));
        people.add(new Person("Джон", 33, nums));

        FileOutputStream fout = null;
        ObjectOutputStream oos = null;

        try {
            System.out.println(Gdx.files.getLocalStoragePath());
            fout = new FileOutputStream("D:\\workspace\\address.lvl");
            oos = new ObjectOutputStream(fout);
            oos.writeObject(people);

            System.out.println("Done");

        } catch (Exception ex) {

            ex.printStackTrace();

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
         
        // десериализация в новый список 
        ArrayList<Person> newPeople = null;
        try {
            FileInputStream fis = new FileInputStream("D:\\workspace\\address.lvl");
            ObjectInputStream ois = new ObjectInputStream(fis);
            newPeople = (ArrayList<Person>) ois.readObject();
            ois.close();

        } catch (Exception e) {
            System.err.println("Exception thrown during test: " + e.toString());
        }
        for(Person p : newPeople)
            System.out.printf("Имя: %s \t Возраст: %d \n", p.getName(), p.getAge());
    }
//    private void writeObject(ObjectOutputStream stream) throws IOException
//    {
//        // "Криптование"/скрытие истинного значения
//        age = age << 2;
//        stream.defaultWriteObject();
//    }
//
//    private void readObject(ObjectInputStream stream) throws IOException,
//            ClassNotFoundException
//    {
//        stream.defaultReadObject();
//        // "Декриптование"/восстановление истинного значения
//        age = age >> 2;
//    }
}